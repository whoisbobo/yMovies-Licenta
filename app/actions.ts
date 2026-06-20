"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { limitReview, limitWatchlist, limitDelete } from "../lib/ratelimit";
import { SUPPORTED_LOCALES } from "../lib/locale";

const reviewSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  rating: z.coerce.number().int().min(1).max(10),
  comment: z.string().max(2000).optional().default(""),
});

const watchlistSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  movieTitle: z.string().min(1).max(500),
  mediaType: z.enum(["movie", "tv"]),
});

const deleteReviewSchema = z.object({
  reviewId: z.coerce.number().int().positive(),
});

const languageSchema = z.enum(SUPPORTED_LOCALES);

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

  await limitReview(userId);
  await ensureUserExists(userId);

  const parsed = reviewSchema.safeParse({
    movieId: formData.get("movieId"),
    mediaType: formData.get("mediaType") || "movie",
    rating: formData.get("rating"),
    comment: formData.get("comment") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Date invalide");
  }

  const { movieId, mediaType, rating, comment } = parsed.data;

  const actualMovieTitle = await fetchMovieTitle(movieId, mediaType);

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
    }
  });

  // UPSERT ATOMIC CU CHEIE COMPUSĂ — elimină fereastra de cursă la submit-uri simultane
  await prisma.review.upsert({
    where: {
      userId_movieId_mediaType: { userId, movieId, mediaType }
    },
    update: { rating, comment },
    create: { rating, comment, userId, movieId, mediaType }
  });

  revalidatePath(`/movie/${movieId}`);
}

export async function deleteReview(reviewIdRaw: number) {
  // 1. Verificăm cine este utilizatorul curent logat în Clerk
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitDelete(userId);

  const parsed = deleteReviewSchema.safeParse({ reviewId: reviewIdRaw });
  if (!parsed.success) throw new Error("ID recenzie invalid");
  const { reviewId } = parsed.data;

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

export async function toggleWatchlist(movieIdRaw: number, movieTitleRaw: string, mediaTypeRaw: string = "movie") {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitWatchlist(userId);

  const parsed = watchlistSchema.safeParse({
    movieId: movieIdRaw,
    movieTitle: movieTitleRaw,
    mediaType: mediaTypeRaw,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Date invalide");
  }

  const { movieId, movieTitle, mediaType } = parsed.data;

  await ensureUserExists(userId);

  // VERIFICARE CU CHEIE COMPUSĂ
  const existingItem = await prisma.watchlistItem.findUnique({
    where: { userId_movieId_mediaType: { userId, movieId, mediaType } },
  });

  if (existingItem) {
    await prisma.watchlistItem.delete({ where: { id: existingItem.id } });
  } else {
    // UPSERT CU CHEIE COMPUSĂ
    await prisma.movie.upsert({
      where: { id_mediaType: { id: movieId, mediaType: mediaType } },
      update: {},
      create: {
        id: movieId,
        mediaType: mediaType,
        title: movieTitle,
      },
    });

    try {
      await prisma.watchlistItem.create({
        data: { userId, movieId, mediaType },
      });
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code !== "P2002") throw error;
      // Deja existent (cerere dublă/simultană) — ignorăm
    }
  }

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/watchlist");
}

export async function changeLanguage(langRaw: string) {
  const parsed = languageSchema.safeParse(langRaw);
  if (!parsed.success) throw new Error("Limbă invalidă");
  const lang = parsed.data;

  const cookieStore = await cookies();
  // Salvăm limba în cookie pentru un an
  cookieStore.set("locale", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  
  // Dăm un refresh "tăcut" la toată aplicația pentru a aplica noua limbă instant
  revalidatePath("/", "layout");
}

