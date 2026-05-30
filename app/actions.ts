"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

async function ensureUserExists(userId: string) {
  const userRecord = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRecord) {
    const clerkUser = await currentUser();
    if (clerkUser) {
      await prisma.user.create({
        data: {
          id: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || "",
          username: clerkUser.username || `user_${userId.slice(0, 5)}`,
          avatarUrl: clerkUser.imageUrl,
        }
      });
    }
  }
}

async function fetchMovieTitle(movieId: number): Promise<string> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}`);
  if (res.ok) {
    const data = await res.json();
    if (data.title) return data.title;
  }
  const tvRes = await fetch(`https://api.themoviedb.org/3/tv/${movieId}?api_key=${process.env.TMDB_API_KEY}`);
  if (tvRes.ok) {
    const data = await tvRes.json();
    if (data.name) return data.name;
  }
  return "Unknown Title";
}



export async function submitReview(formData: FormData) {
  // 1. Verificăm cine trimite recenzia
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await ensureUserExists(userId);

  // 2. Preluăm datele din formular și le validăm
  const movieIdRaw = formData.get("movieId");
  const ratingRaw = formData.get("rating");
  const comment = formData.get("comment") as string;

  const movieId = parseInt(movieIdRaw as string);
  const rating = parseInt(ratingRaw as string);

  if (isNaN(movieId) || movieId <= 0) throw new Error("ID film invalid");
  if (isNaN(rating) || rating < 1 || rating > 10) throw new Error("Rating invalid");
  if (comment && comment.length > 2000) throw new Error("Comentariul este prea lung");

  const actualMovieTitle = await fetchMovieTitle(movieId);

  // 3. Creăm o categorie generică (obligatorie pentru relația din schema Prisma)
  const category = await prisma.category.upsert({
    where: { name: "General" },
    update: {},
    create: { name: "General" }
  });

  // 4. Salvăm filmul în Supabase (dacă e prima dată când cineva îi dă review)
  await prisma.movie.upsert({
    where: { id: movieId },
    update: {}, // Dacă există deja, nu-i facem nimic
    create: {
      id: movieId,
      title: actualMovieTitle,
      categoryId: category.id,
    }
  });

  // 5. Salvăm recenzia
  // Funcția 'findUnique' se asigură că nu lăsăm 2 recenzii la același film, așa cum e setat în schema ta
  const existingReview = await prisma.review.findUnique({
    where: {
      userId_movieId: {
        userId: userId,
        movieId: movieId
      }
    }
  });

  if (existingReview) {
    // Dacă utilizatorul a mai lăsat o recenzie, o actualizăm
    await prisma.review.update({
      where: { id: existingReview.id },
      data: { rating, comment }
    });
  } else {
    // Dacă e prima dată, o creăm
    await prisma.review.create({
      data: { rating, comment, userId, movieId }
    });
  }

  // 6. Dăm un refresh automat paginii filmului pentru a vedea datele noi
  revalidatePath(`/movie/${movieId}`);
}

export async function deleteReview(reviewId: number) {
  // 1. Verificăm cine este utilizatorul curent logat în Clerk
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  // 2. Extragem datele utilizatorului din baza noastră pentru a-i vedea ROLUL
  const currentUserRecord = await prisma.user.findUnique({
    where: { id: userId }
  });

  // 3. Găsim recenzia pe care vrea să o șteargă
  const review = await prisma.review.findUnique({
    where: { id: reviewId }
  });

  if (!review) throw new Error("Recenzia nu a fost găsită");

  // 4. VERIFICAREA CRUCIALĂ DE SECURITATE:
  // Permitem ștergerea DOAR dacă: utilizatorul este ADMIN sau este chiar cel care a scris recenzia
  const isAdmin = currentUserRecord?.role === "ADMIN";
  const isOwner = review.userId === userId;

  if (!isAdmin && !isOwner) {
    throw new Error("Nu ai permisiunea de a șterge această recenzie!");
  }

  // 5. Dacă a trecut testul, o ștergem
  await prisma.review.delete({
    where: { id: reviewId }
  });

  // 6. Refresh automat la pagină
  revalidatePath(`/movie/${review.movieId}`);
}

export async function toggleWatchlist(movieId: number, movieTitle: string) {
  // 1. Verificăm dacă utilizatorul este logat
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await ensureUserExists(userId);

  if (isNaN(movieId) || movieId <= 0) throw new Error("ID film invalid");

  // 2. Verificăm dacă filmul există deja în watchlist-ul utilizatorului
  const existingItem = await prisma.watchlistItem.findUnique({
    where: {
      userId_movieId: {
        userId: userId,
        movieId: movieId,
      },
    },
  });

  if (existingItem) {
    // Dacă există deja, utilizatorul vrea să îl șteargă din listă
    await prisma.watchlistItem.delete({
      where: { id: existingItem.id },
    });
  } else {
    // Dacă nu există, trebuie mai întâi să ne asigurăm că filmul este înregistrat în Supabase (la fel ca la recenzii)
    const actualMovieTitle = await fetchMovieTitle(movieId);

    const category = await prisma.category.upsert({
      where: { name: "General" },
      update: {},
      create: { name: "General" },
    });

    await prisma.movie.upsert({
      where: { id: movieId },
      update: {},
      create: {
        id: movieId,
        title: actualMovieTitle,
        categoryId: category.id,
      },
    });

    // Adăugăm efectiv filmul în watchlist
    try {
      await prisma.watchlistItem.create({
        data: {
          userId: userId,
          movieId: movieId,
        },
      });
    } catch (error: any) {
      if (error.code !== 'P2002') {
        throw error;
      }
    }
  }

  // Actualizăm automat paginile pentru a reflecta schimbarea în interfață
  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/watchlist");
}

export async function changeLanguage(lang: string) {
  const cookieStore = await cookies();
  // Salvăm limba în cookie pentru un an
  cookieStore.set("locale", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  
  // Dăm un refresh "tăcut" la toată aplicația pentru a aplica noua limbă instant
  revalidatePath("/", "layout");
}