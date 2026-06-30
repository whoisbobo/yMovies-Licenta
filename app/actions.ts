"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { limitReview, limitWatchlist, limitDelete, limitCheckout, limitWatched, limitLike, limitFavorite, limitProfile, limitFollow, limitComment } from "../lib/ratelimit";
import { SUPPORTED_LOCALES, toTmdbLang } from "../lib/locale";
import { getStripe } from "../lib/stripe";
import { FAVORITE_LIMIT, MOVIE_GENRES, FAVORITE_GENRES_LIMIT } from "../lib/constants";
import { getLocale } from "next-intl/server";

const reviewSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  comment: z.string().trim().min(1).max(2000),
  hasSpoiler: z.coerce.boolean().default(false),
});

const ratingValueSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  value: z.coerce.number().int().min(1).max(10),
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
    comment: formData.get("comment") ?? "",
    hasSpoiler: formData.get("hasSpoiler") === "on" || formData.get("hasSpoiler") === "true",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Date invalide");
  }

  const { movieId, mediaType, comment, hasSpoiler } = parsed.data;

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

  // Recenzia = doar text. Nota e separată (vezi setRating).
  await prisma.review.upsert({
    where: {
      userId_movieId_mediaType: { userId, movieId, mediaType }
    },
    update: { comment, hasSpoiler },
    create: { comment, hasSpoiler, userId, movieId, mediaType }
  });

  // A scrie o recenzie implică automat că l-ai văzut, și se scoate din watchlist.
  await markWatchedAndDropFromWatchlist(userId, movieId, mediaType);

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/reviews");
  revalidatePath("/profile");
  revalidatePath("/watched");
  revalidatePath("/watchlist");
}

// Notare independentă de recenzie — scrie în modelul Rating, separat.
export async function setRating(movieIdRaw: number, mediaTypeRaw: string, movieTitleRaw: string, valueRaw: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitReview(userId);

  const parsed = ratingValueSchema.safeParse({ movieId: movieIdRaw, mediaType: mediaTypeRaw, value: valueRaw });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Date invalide");

  const { movieId, mediaType, value } = parsed.data;

  await ensureUserExists(userId);

  const title = (movieTitleRaw && String(movieTitleRaw).trim()) || (await fetchMovieTitle(movieId, mediaType));

  await prisma.movie.upsert({
    where: { id_mediaType: { id: movieId, mediaType } },
    update: {},
    create: { id: movieId, mediaType, title },
  });

  await prisma.rating.upsert({
    where: { userId_movieId_mediaType: { userId, movieId, mediaType } },
    update: { value },
    create: { userId, movieId, mediaType, value },
  });

  // Notarea implică automat că l-ai văzut (ca pe Letterboxd) — intră în Films,
  // și se scoate din watchlist (nu mai e "de văzut").
  await markWatchedAndDropFromWatchlist(userId, movieId, mediaType);

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/watched");
  revalidatePath("/watchlist");
  revalidatePath("/profile");
  revalidatePath("/reviews");
}

export async function removeRating(movieIdRaw: number, mediaTypeRaw: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitReview(userId);

  const movieId = z.coerce.number().int().positive().parse(movieIdRaw);
  const mediaType = z.enum(["movie", "tv"]).parse(mediaTypeRaw);

  await prisma.rating.deleteMany({ where: { userId, movieId, mediaType } });

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/watched");
  revalidatePath("/profile");
  revalidatePath("/reviews");
}

// Urmărește / nu mai urmări un alt utilizator. Întoarce starea nouă (true = urmărit).
export async function toggleFollow(targetUserId: string): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitFollow(userId);

  const parsedTarget = z.string().trim().min(1).safeParse(targetUserId);
  if (!parsedTarget.success) throw new Error("Utilizator invalid");
  const followingId = parsedTarget.data;

  if (followingId === userId) throw new Error("Nu te poți urmări pe tine însuți");

  await ensureUserExists(userId);

  const target = await prisma.user.findUnique({ where: { id: followingId }, select: { id: true, username: true } });
  if (!target) throw new Error("Utilizatorul nu există");

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId } },
  });

  let nowFollowing: boolean;
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    nowFollowing = false;
  } else {
    try {
      await prisma.follow.create({ data: { followerId: userId, followingId } });
      await createNotification(followingId, userId, "FOLLOW");
    } catch (e: unknown) {
      // Ignoră cursa de dublu-click (P2002 = unique constraint)
      if (!(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002")) throw e;
    }
    nowFollowing = true;
  }

  revalidatePath("/profile");
  revalidatePath("/users");
  revalidatePath(`/users/${target.username}`);

  return nowFollowing;
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
  revalidatePath("/reviews");
}

// Marchează un film ca văzut și îl scoate din watchlist (nu mai e "de văzut").
// Folosit oriunde un film devine văzut: buton Watched, notă, recenzie, like.
async function markWatchedAndDropFromWatchlist(userId: string, movieId: number, mediaType: "movie" | "tv") {
  await prisma.watched.upsert({
    where: { userId_movieId_mediaType: { userId, movieId, mediaType } },
    update: {},
    create: { userId, movieId, mediaType },
  });
  await prisma.watchlistItem.deleteMany({ where: { userId, movieId, mediaType } });
}

export async function toggleWatchlist(movieIdRaw: number, movieTitleRaw: string, mediaTypeRaw: string = "movie") {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitWatchlist(userId);

  const parsed = watchlistSchema.safeParse({ movieId: movieIdRaw, movieTitle: movieTitleRaw, mediaType: mediaTypeRaw });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Date invalide");
  const { movieId, movieTitle, mediaType } = parsed.data;

  await ensureUserExists(userId);

  const existing = await prisma.watchlistItem.findUnique({ where: { userId_movieId_mediaType: { userId, movieId, mediaType } } });
  if (existing) {
    await prisma.watchlistItem.delete({ where: { id: existing.id } });
  } else {
    // Nu adăugăm în watchlist un film deja văzut — nu mai e "de văzut".
    const watched = await prisma.watched.findUnique({ where: { userId_movieId_mediaType: { userId, movieId, mediaType } } });
    if (watched) throw new Error("Filmul este deja marcat ca văzut");
    await prisma.movie.upsert({ where: { id_mediaType: { id: movieId, mediaType } }, update: {}, create: { id: movieId, mediaType, title: movieTitle } });
    await prisma.watchlistItem.create({ data: { userId, movieId, mediaType } });
  }

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/watchlist");
}

const favoriteSlotSchema = z.object({
  position: z.coerce.number().int().min(0).max(FAVORITE_LIMIT - 1),
  movieId: z.coerce.number().int().positive(),
  movieTitle: z.string().min(1).max(500),
  mediaType: z.enum(["movie", "tv"]),
});

export async function setFavoriteSlot(
  positionRaw: number,
  movieIdRaw: number,
  movieTitleRaw: string,
  mediaTypeRaw: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitFavorite(userId);

  const parsed = favoriteSlotSchema.safeParse({
    position: positionRaw,
    movieId: movieIdRaw,
    movieTitle: movieTitleRaw,
    mediaType: mediaTypeRaw,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Date invalide");
  }
  const { position, movieId, movieTitle, mediaType } = parsed.data;

  await ensureUserExists(userId);

  await prisma.movie.upsert({
    where: { id_mediaType: { id: movieId, mediaType } },
    update: {},
    create: { id: movieId, mediaType, title: movieTitle },
  });

  // Eliminăm orice favorite anterior din acest slot SAU al aceluiași film
  // (dacă era deja pus în alt slot), ca să nu rămână duplicat/slot orfan.
  await prisma.favorite.deleteMany({
    where: { userId, OR: [{ position }, { movieId, mediaType }] },
  });

  await prisma.favorite.create({ data: { userId, movieId, mediaType, position } });

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
}

export async function removeFavoriteSlot(positionRaw: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitFavorite(userId);

  const position = z.coerce.number().int().min(0).max(FAVORITE_LIMIT - 1).parse(positionRaw);

  await prisma.favorite.deleteMany({ where: { userId, position } });

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
}

const reorderSlotSchema = z
  .object({
    movieId: z.coerce.number().int().positive(),
    mediaType: z.enum(["movie", "tv"]),
    title: z.string().min(1).max(500),
  })
  .nullable();

// Rescrie complet ordinea favoritelor (după drag & drop). Primește sloturile
// în noua ordine (cu null pentru goale); recreează totul în tranzacție.
export async function reorderFavorites(slotsRaw: unknown[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitFavorite(userId);

  const slots = z.array(reorderSlotSchema).max(FAVORITE_LIMIT).parse(slotsRaw);

  await ensureUserExists(userId);

  await prisma.$transaction(async (tx) => {
    await tx.favorite.deleteMany({ where: { userId } });
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s) continue;
      await tx.movie.upsert({
        where: { id_mediaType: { id: s.movieId, mediaType: s.mediaType } },
        update: {},
        create: { id: s.movieId, mediaType: s.mediaType, title: s.title },
      });
      await tx.favorite.create({ data: { userId, movieId: s.movieId, mediaType: s.mediaType, position: i } });
    }
  });

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
}

const profileDetailsSchema = z.object({
  displayName: z.string().trim().max(50).transform((v) => (v.length === 0 ? null : v)),
  bio: z.string().trim().max(500).transform((v) => (v.length === 0 ? null : v)),
  location: z.string().trim().max(80).transform((v) => (v.length === 0 ? null : v)),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v.length === 0 ? null : v))
    .refine((v) => v === null || /^https?:\/\/.+\..+/.test(v), { message: "Website invalid (folosește http(s)://)" }),
  favoriteGenres: z.array(z.enum(MOVIE_GENRES)).max(FAVORITE_GENRES_LIMIT),
});

export async function updateProfileDetails(
  displayNameRaw: string,
  bioRaw: string,
  locationRaw: string,
  websiteRaw: string,
  favoriteGenresRaw: string[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitProfile(userId);

  const parsed = profileDetailsSchema.safeParse({
    displayName: displayNameRaw,
    bio: bioRaw,
    location: locationRaw,
    website: websiteRaw,
    favoriteGenres: favoriteGenresRaw,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Date invalide");

  await ensureUserExists(userId);
  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: parsed.data.displayName,
      bio: parsed.data.bio,
      location: parsed.data.location,
      website: parsed.data.website,
      favoriteGenres: parsed.data.favoriteGenres,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
}

const favoriteSearchSchema = z.string().trim().min(1).max(200);

export type FavoriteSearchResult = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  year: string | null;
};

export async function searchMoviesForFavorite(queryRaw: string): Promise<FavoriteSearchResult[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  const parsed = favoriteSearchSchema.safeParse(queryRaw);
  if (!parsed.success) return [];
  const query = parsed.data;

  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);

  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&language=${encodeURIComponent(tmdbLang)}&query=${encodeURIComponent(query)}&page=1`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data.results || [])
    .filter((item: { media_type?: string }) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 8)
    .map((item: { id: number; media_type: string; title?: string; name?: string; poster_path: string | null; release_date?: string; first_air_date?: string }) => ({
      id: item.id,
      mediaType: item.media_type as "movie" | "tv",
      title: item.title || item.name || "—",
      posterPath: item.poster_path,
      year: (item.release_date || item.first_air_date || "").substring(0, 4) || null,
    }));
}

// Sugestii live pentru search bar — public (merge și fără autentificare).
export async function searchSuggestions(queryRaw: string): Promise<FavoriteSearchResult[]> {
  const parsed = favoriteSearchSchema.safeParse(queryRaw);
  if (!parsed.success) return [];
  const query = parsed.data;

  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);

  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&language=${encodeURIComponent(tmdbLang)}&query=${encodeURIComponent(query)}&page=1`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data.results || [])
    .filter((item: { media_type?: string }) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 6)
    .map((item: { id: number; media_type: string; title?: string; name?: string; poster_path: string | null; release_date?: string; first_air_date?: string }) => ({
      id: item.id,
      mediaType: item.media_type as "movie" | "tv",
      title: item.title || item.name || "—",
      posterPath: item.poster_path,
      year: (item.release_date || item.first_air_date || "").substring(0, 4) || null,
    }));
}

export async function toggleWatched(movieIdRaw: number, movieTitleRaw: string, mediaTypeRaw: string = "movie") {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitWatched(userId);

  const parsed = watchlistSchema.safeParse({ movieId: movieIdRaw, movieTitle: movieTitleRaw, mediaType: mediaTypeRaw });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Date invalide");
  const { movieId, movieTitle, mediaType } = parsed.data;

  await ensureUserExists(userId);

  const existing = await prisma.watched.findUnique({ where: { userId_movieId_mediaType: { userId, movieId, mediaType } } });
  if (existing) {
    await prisma.watched.delete({ where: { id: existing.id } });
  } else {
    await prisma.movie.upsert({ where: { id_mediaType: { id: movieId, mediaType } }, update: {}, create: { id: movieId, mediaType, title: movieTitle } });
    // Marcarea ca văzut îl scoate și din watchlist.
    await markWatchedAndDropFromWatchlist(userId, movieId, mediaType);
  }

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/profile");
  revalidatePath("/watched");
  revalidatePath("/watchlist");
}

// De-marcare „văzut" care șterge și nota și recenzia (după confirmarea din pop-up).
export async function unwatchWithCascade(movieIdRaw: number, mediaTypeRaw: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitWatched(userId);

  const movieId = z.coerce.number().int().positive().parse(movieIdRaw);
  const mediaType = z.enum(["movie", "tv"]).parse(mediaTypeRaw);

  await prisma.$transaction([
    prisma.watched.deleteMany({ where: { userId, movieId, mediaType } }),
    prisma.rating.deleteMany({ where: { userId, movieId, mediaType } }),
    prisma.review.deleteMany({ where: { userId, movieId, mediaType } }),
  ]);

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/profile");
  revalidatePath("/watched");
  revalidatePath("/reviews");
}

export async function toggleLike(movieIdRaw: number, movieTitleRaw: string, mediaTypeRaw: string = "movie") {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitLike(userId);

  const parsed = watchlistSchema.safeParse({ movieId: movieIdRaw, movieTitle: movieTitleRaw, mediaType: mediaTypeRaw });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Date invalide");
  const { movieId, movieTitle, mediaType } = parsed.data;

  await ensureUserExists(userId);

  const existing = await prisma.like.findUnique({ where: { userId_movieId_mediaType: { userId, movieId, mediaType } } });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.movie.upsert({ where: { id_mediaType: { id: movieId, mediaType } }, update: {}, create: { id: movieId, mediaType, title: movieTitle } });
    await prisma.like.create({ data: { userId, movieId, mediaType } });
    // Un like presupune că l-ai văzut → marchează văzut + scoate din watchlist.
    await markWatchedAndDropFromWatchlist(userId, movieId, mediaType);
  }

  revalidatePath(`/movie/${movieId}`);
  revalidatePath("/profile");
  revalidatePath("/watched");
  revalidatePath("/watchlist");
}

// ===== Notificări =====
// Creează o notificare (best-effort). Nu te notifici pe tine însuți.
async function createNotification(
  recipientId: string,
  actorId: string,
  type: "FOLLOW" | "REVIEW_LIKE" | "REVIEW_COMMENT",
  movieId?: number,
  mediaType?: "movie" | "tv"
) {
  if (recipientId === actorId) return;
  try {
    await prisma.notification.create({
      data: { recipientId, actorId, type, movieId: movieId ?? null, mediaType: mediaType ?? null },
    });
    revalidatePath("/notifications");
  } catch {
    // O eroare la notificare nu trebuie să strice acțiunea principală.
  }
}

export async function markAllNotificationsRead() {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");
  await prisma.notification.updateMany({ where: { recipientId: userId, read: false }, data: { read: true } });
  revalidatePath("/notifications");
}

// ===== Comentarii & like-uri la recenzii =====

export type ReviewCommentDTO = {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

const reviewCommentSchema = z.string().trim().min(1).max(1000);

export async function addReviewComment(reviewIdRaw: number, textRaw: string): Promise<ReviewCommentDTO> {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitComment(userId);

  const reviewId = z.coerce.number().int().positive().parse(reviewIdRaw);
  const parsed = reviewCommentSchema.safeParse(textRaw);
  if (!parsed.success) throw new Error("Comentariu invalid");

  await ensureUserExists(userId);

  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { movieId: true, mediaType: true, userId: true } });
  if (!review) throw new Error("Recenzia nu există");

  const created = await prisma.reviewComment.create({
    data: { reviewId, userId, text: parsed.data },
    include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
  });

  await createNotification(review.userId, userId, "REVIEW_COMMENT", review.movieId, review.mediaType);

  revalidatePath(`/movie/${review.movieId}`);

  return {
    id: created.id,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
    userId: created.userId,
    username: created.user.username,
    displayName: created.user.displayName,
    avatarUrl: created.user.avatarUrl,
  };
}

export async function deleteReviewComment(commentIdRaw: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  const commentId = z.string().trim().min(1).parse(commentIdRaw);

  const comment = await prisma.reviewComment.findUnique({
    where: { id: commentId },
    select: { userId: true, review: { select: { movieId: true } } },
  });
  if (!comment) throw new Error("Comentariul nu există");

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const isAdmin = me?.role === "ADMIN";
  if (comment.userId !== userId && !isAdmin) throw new Error("Nu ai permisiunea");

  await prisma.reviewComment.delete({ where: { id: commentId } });
  revalidatePath(`/movie/${comment.review.movieId}`);
}

// Like / unlike pe o recenzie. Întoarce noua stare + numărul de like-uri.
export async function toggleReviewLike(reviewIdRaw: number): Promise<{ liked: boolean; count: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitLike(userId);

  const reviewId = z.coerce.number().int().positive().parse(reviewIdRaw);

  await ensureUserExists(userId);

  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { movieId: true, mediaType: true, userId: true } });
  if (!review) throw new Error("Recenzia nu există");

  const existing = await prisma.reviewLike.findUnique({ where: { reviewId_userId: { reviewId, userId } } });
  let liked: boolean;
  if (existing) {
    await prisma.reviewLike.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    try {
      await prisma.reviewLike.create({ data: { reviewId, userId } });
      await createNotification(review.userId, userId, "REVIEW_LIKE", review.movieId, review.mediaType);
    } catch (e: unknown) {
      if (!(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002")) throw e;
    }
    liked = true;
  }

  const count = await prisma.reviewLike.count({ where: { reviewId } });
  revalidatePath(`/movie/${review.movieId}`);
  return { liked, count };
}

// ===== Admin =====
// Verifică server-side că apelantul e ADMIN (gardă pentru toate acțiunile de admin).
async function assertAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (me?.role !== "ADMIN") throw new Error("Acces interzis");
  return userId;
}

export async function setUserRole(targetUserId: string, roleRaw: string) {
  const adminId = await assertAdmin();
  const role = z.enum(["USER", "ADMIN"]).parse(roleRaw);
  const target = z.string().trim().min(1).parse(targetUserId);
  // Nu te poți retrograda singur (ar bloca accesul la panou).
  if (target === adminId && role !== "ADMIN") throw new Error("Nu te poți retrograda pe tine însuți");
  await prisma.user.update({ where: { id: target }, data: { role } });
  revalidatePath("/admin");
}

export async function setUserPremium(targetUserId: string, isPremiumRaw: boolean) {
  await assertAdmin();
  const target = z.string().trim().min(1).parse(targetUserId);
  const isPremium = z.boolean().parse(isPremiumRaw);
  await prisma.user.update({ where: { id: target }, data: { isPremium } });
  revalidatePath("/admin");
}

export async function adminDeleteReview(reviewIdRaw: number) {
  await assertAdmin();
  const reviewId = z.coerce.number().int().positive().parse(reviewIdRaw);
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { movieId: true } });
  await prisma.review.deleteMany({ where: { id: reviewId } });
  if (review) revalidatePath(`/movie/${review.movieId}`);
  revalidatePath("/admin");
  revalidatePath("/reviews");
}

async function getOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function createCheckoutSession() {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitCheckout(userId);
  await ensureUserExists(userId);
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) throw new Error("Utilizator inexistent");

  if (dbUser.isPremium) {
    throw new Error("Ai deja abonamentul Premium activ");
  }

  const stripe = getStripe();
  const origin = await getOrigin();

  let customerId = dbUser.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser.email,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/premium?success=true`,
    cancel_url: `${origin}/premium?canceled=true`,
    metadata: { userId },
  });

  if (!session.url) throw new Error("Nu s-a putut crea sesiunea de checkout");

  redirect(session.url);
}

export async function createBillingPortalSession() {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  await limitCheckout(userId);

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser?.stripeCustomerId) throw new Error("Nu ai un abonament activ");

  const stripe = getStripe();
  const origin = await getOrigin();

  const session = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${origin}/premium`,
  });

  redirect(session.url);
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

