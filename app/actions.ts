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

// Acum primește și parametrul mediaType
async function fetchMovieTitle(movieId: number, mediaType: string): Promise<string> {
  const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${process.env.TMDB_API_KEY}`);
  
  if (res.ok) {
    const data = await res.json();
    // TMDB folosește 'title' pentru filme și 'name' pentru seriale
    return data.title || data.name || "Unknown Title";
  }
  
  return "Unknown Title";
}



export async function submitReview(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await ensureUserExists(userId);

  const movieIdRaw = formData.get("movieId");
  const ratingRaw = formData.get("rating");
  const comment = formData.get("comment") as string;
  
  // PRELUĂM TIPUL MEDIA DIN FORMULAR
  const mediaType = (formData.get("mediaType") as string) || "movie";

  const movieId = parseInt(movieIdRaw as string);
  const rating = parseInt(ratingRaw as string);

  if (isNaN(movieId) || movieId <= 0) throw new Error("ID film invalid");
  if (isNaN(rating) || rating < 1 || rating > 10) throw new Error("Rating invalid");
  if (comment && comment.length > 2000) throw new Error("Comentariul este prea lung");

  const actualMovieTitle = await fetchMovieTitle(movieId, mediaType);

  const category = await prisma.category.upsert({
    where: { name: "General" },
    update: {},
    create: { name: "General" }
  });

  // UPSERT CU CHEIE COMPUSĂ
  await prisma.movie.upsert({
    where: { 
      id_mediaType: { id: movieId, mediaType: mediaType } 
    },
    update: {}, 
    create: {
      id: movieId,
      mediaType: mediaType,
      title: actualMovieTitle,
      categoryId: category.id,
    }
  });

  // VERIFICARE REVIEW CU CHEIE COMPUSĂ
  const existingReview = await prisma.review.findUnique({
    where: {
      userId_movieId_mediaType: { userId, movieId, mediaType }
    }
  });

  if (existingReview) {
    await prisma.review.update({
      where: { id: existingReview.id },
      data: { rating, comment }
    });
  } else {
    await prisma.review.create({
      data: { rating, comment, userId, movieId, mediaType }
    });
  }

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

export async function toggleWatchlist(movieId: number, movieTitle: string, mediaType: string = "movie") {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  // VERIFICARE CU CHEIE COMPUSĂ
  const existingItem = await prisma.watchlistItem.findUnique({
    where: { userId_movieId_mediaType: { userId, movieId, mediaType } },
  });

  if (existingItem) {
    await prisma.watchlistItem.delete({ where: { id: existingItem.id } });
  } else {
    const category = await prisma.category.upsert({
      where: { name: "General" },
      update: {},
      create: { name: "General" },
    });

    // UPSERT CU CHEIE COMPUSĂ
    await prisma.movie.upsert({
      where: { id_mediaType: { id: movieId, mediaType: mediaType } },
      update: {},
      create: {
        id: movieId,
        mediaType: mediaType,
        title: movieTitle,
        categoryId: category.id,
      },
    });

    await prisma.watchlistItem.create({
      data: { userId, movieId, mediaType },
    });
  }

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

