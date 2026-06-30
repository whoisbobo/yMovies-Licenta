import { prisma } from "./prisma";
import { getCachedMovieDetails } from "./tmdbCache";

export type ActivityType = "rated" | "liked" | "reviewed" | "watchlisted" | "followed";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  movieId: number; // 0 pentru "followed"
  mediaType: "movie" | "tv";
  title: string; // titlul filmului SAU numele userului urmărit
  rating: number | null; // doar pentru "rated" (1..10)
  createdAt: Date;
  targetUsername: string | null; // pentru "followed": username-ul celui urmărit
};

// Timp relativ compact, stil Letterboxd: "7h", "16h", "3d", "2w"...
export function relativeTime(date: Date): string {
  const sec = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.round(day / 365)}y`;
}

// Feed unificat: note + like-uri + recenzii + adăugări în watchlist, sortate
// cronologic descrescător. Fiecare e o "activitate" distinctă (ca pe Letterboxd).
export async function getActivityFeed(
  userId: string,
  tmdbLang: string,
  limit: number
): Promise<ActivityItem[]> {
  const [ratings, likes, reviews, watchlist, follows] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, movieId: true, mediaType: true, value: true, createdAt: true } }),
    prisma.like.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, movieId: true, mediaType: true, createdAt: true } }),
    prisma.review.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, movieId: true, mediaType: true, createdAt: true } }),
    prisma.watchlistItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, movieId: true, mediaType: true, createdAt: true } }),
    prisma.follow.findMany({ where: { followerId: userId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, createdAt: true, following: { select: { username: true, displayName: true } } } }),
  ]);

  // Evenimentele cu film au titlul gol (se hidratează din TMDB); follow-ul are deja numele.
  const movieEvents: ActivityItem[] = [
    ...ratings.map((r) => ({ id: `r${r.id}`, type: "rated" as const, movieId: r.movieId, mediaType: r.mediaType, rating: r.value, createdAt: r.createdAt, title: "", targetUsername: null })),
    ...likes.map((l) => ({ id: `l${l.id}`, type: "liked" as const, movieId: l.movieId, mediaType: l.mediaType, rating: null, createdAt: l.createdAt, title: "", targetUsername: null })),
    ...reviews.map((v) => ({ id: `v${v.id}`, type: "reviewed" as const, movieId: v.movieId, mediaType: v.mediaType, rating: null, createdAt: v.createdAt, title: "", targetUsername: null })),
    ...watchlist.map((w) => ({ id: `w${w.id}`, type: "watchlisted" as const, movieId: w.movieId, mediaType: w.mediaType, rating: null, createdAt: w.createdAt, title: "", targetUsername: null })),
  ];

  const followEvents: ActivityItem[] = follows.map((f) => ({
    id: `f${f.id}`,
    type: "followed" as const,
    movieId: 0,
    mediaType: "movie" as const,
    rating: null,
    createdAt: f.createdAt,
    title: f.following.displayName || f.following.username,
    targetUsername: f.following.username,
  }));

  const all = [...movieEvents, ...followEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const top = all.slice(0, limit);

  // Hidratăm doar evenimentele cu film (follow-ul are deja numele setat).
  return Promise.all(
    top.map(async (item) => {
      if (item.type === "followed") return item;
      const details = (await getCachedMovieDetails(item.movieId, item.mediaType, tmdbLang)) as
        | { title?: string; name?: string }
        | null;
      return { ...item, title: details?.title || details?.name || "—" };
    })
  );
}
