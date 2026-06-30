import { prisma } from "./prisma";
import { getCachedMovieDetails } from "./tmdbCache";

export type GenreStat = { name: string; count: number };
export type YearStat = { year: number; count: number };

const TOP_GENRES_COUNT = 8;

/**
 * Statistici de vizionare pentru funcția Premium "Ce filme îmi plac" —
 * agregă genurile și anii de lansare din istoricul de recenzii al userului,
 * folosind datele deja cache-uite (PageCache), fără cereri noi către TMDB.
 */
export async function getViewingStats(
  userId: string,
  lang: string
): Promise<{ genreStats: GenreStat[]; yearStats: YearStat[]; totalReviews: number }> {
  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: { movieId: true, mediaType: true },
  });

  const genreCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();

  await Promise.all(
    ratings.map(async (review) => {
      const details = await getCachedMovieDetails(review.movieId, review.mediaType, lang);
      if (!details) return;

      const genres = (details as { genres?: { id: number; name: string }[] }).genres;
      genres?.forEach((genre) => {
        genreCounts.set(genre.name, (genreCounts.get(genre.name) ?? 0) + 1);
      });

      const dateStr =
        (details as { release_date?: string; first_air_date?: string }).release_date ||
        (details as { release_date?: string; first_air_date?: string }).first_air_date;
      if (dateStr) {
        const year = parseInt(dateStr.substring(0, 4), 10);
        if (!Number.isNaN(year)) {
          yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
        }
      }
    })
  );

  const genreStats = Array.from(genreCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_GENRES_COUNT);

  const yearStats = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  return { genreStats, yearStats, totalReviews: ratings.length };
}

export type RatingBucket = { rating: number; count: number };

/**
 * Distribuția notelor (1-10, afișate ca 0.5-5.0 stele în UI) — folosită pe
 * pagina de profil, gen "Ratings" de pe Letterboxd. Nu necesită date TMDB.
 */
export async function getRatingHistogram(userId: string): Promise<RatingBucket[]> {
  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: { value: true },
  });

  const counts = new Map<number, number>();
  for (let rating = 1; rating <= 10; rating++) {
    counts.set(rating, 0);
  }
  for (const r of ratings) {
    counts.set(r.value, (counts.get(r.value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => a.rating - b.rating);
}

export type MonthBucket = { label: string; count: number };
export type RatedFilm = { movieId: number; mediaType: "movie" | "tv"; title: string; posterPath: string | null; rating: number };
export type GenreRating = { name: string; avg: number; count: number };

export type DetailedStats = {
  totalWatched: number;
  totalHours: number;
  totalLiked: number;
  totalRated: number;
  avgStars: number | null; // nota ta medie (0.5-5)
  ratingHistogram: RatingBucket[];
  genreStats: GenreStat[];
  decadeStats: { decade: number; count: number }[]; // axă continuă, zero unde lipsesc
  watchedPerMonth: MonthBucket[]; // ultimele 12 luni
  critic: { yours: number; tmdb: number } | null; // medii pe scară de stele
  moviesCount: number;
  tvCount: number;
  topRated: RatedFilm[];
  bottomRated: RatedFilm[];
  genreRatings: GenreRating[]; // nota medie pe gen
};

/**
 * Statistici detaliate pentru pagina Premium. Hidratează o singură dată
 * detaliile filmelor văzute și calculează tot: ore, genuri, ani, distribuția
 * notelor, vizionări pe lună, și comparația notei tale cu media TMDB.
 */
export async function getDetailedStats(userId: string, tmdbLang: string): Promise<DetailedStats> {
  const [watched, ratings, likeCount] = await Promise.all([
    prisma.watched.findMany({ where: { userId }, select: { movieId: true, mediaType: true, createdAt: true } }),
    prisma.rating.findMany({ where: { userId }, select: { movieId: true, mediaType: true, value: true } }),
    prisma.like.count({ where: { userId } }),
  ]);

  const ratingMap = new Map(ratings.map((r) => [`${r.mediaType}:${r.movieId}`, r.value]));

  const detailed = await Promise.all(
    watched.map(async (w) => ({
      w,
      d: (await getCachedMovieDetails(w.movieId, w.mediaType, tmdbLang)) as {
        title?: string;
        name?: string;
        poster_path?: string | null;
        runtime?: number;
        episode_run_time?: number[];
        genres?: { name: string }[];
        release_date?: string;
        first_air_date?: string;
        vote_average?: number;
      } | null,
    }))
  );

  let totalMinutes = 0;
  const genreCounts = new Map<string, number>();
  const decadeCounts = new Map<number, number>();
  let yourCriticSum = 0;
  let tmdbCriticSum = 0;
  let criticCount = 0;
  const monthCount = new Map<string, number>();
  const genreRatingSum = new Map<string, number>();
  const genreRatingCount = new Map<string, number>();
  const ratedFilms: RatedFilm[] = [];

  for (const { w, d } of detailed) {
    const dt = new Date(w.createdAt);
    const mKey = `${dt.getFullYear()}-${dt.getMonth()}`;
    monthCount.set(mKey, (monthCount.get(mKey) ?? 0) + 1);

    if (!d) continue;

    const runtime = d.runtime ?? d.episode_run_time?.[0] ?? 0;
    if (runtime) totalMinutes += runtime;

    (d.genres || []).forEach((g) => genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1));

    const dateStr = d.release_date || d.first_air_date;
    if (dateStr) {
      const y = parseInt(dateStr.substring(0, 4), 10);
      if (!Number.isNaN(y)) {
        const dec = Math.floor(y / 10) * 10;
        decadeCounts.set(dec, (decadeCounts.get(dec) ?? 0) + 1);
      }
    }

    const val = ratingMap.get(`${w.mediaType}:${w.movieId}`);
    if (val != null) {
      ratedFilms.push({
        movieId: w.movieId,
        mediaType: w.mediaType,
        title: d.title || d.name || "—",
        posterPath: d.poster_path ?? null,
        rating: val,
      });
      (d.genres || []).forEach((g) => {
        genreRatingSum.set(g.name, (genreRatingSum.get(g.name) ?? 0) + val / 2);
        genreRatingCount.set(g.name, (genreRatingCount.get(g.name) ?? 0) + 1);
      });
      if (typeof d.vote_average === "number" && d.vote_average > 0) {
        yourCriticSum += val / 2;
        tmdbCriticSum += d.vote_average / 2;
        criticCount++;
      }
    }
  }

  // Vizionări pe lună — ultimele 12 luni, cu zero unde lipsesc.
  const monthFmt = new Intl.DateTimeFormat(tmdbLang, { month: "short" });
  const now = new Date();
  const watchedPerMonth: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    watchedPerMonth.push({ label: monthFmt.format(dt), count: monthCount.get(`${dt.getFullYear()}-${dt.getMonth()}`) ?? 0 });
  }

  const genreStats = Array.from(genreCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_GENRES_COUNT);

  // Axă continuă de decenii (umplem cu zero deceniile fără filme).
  const decadeStats: { decade: number; count: number }[] = [];
  if (decadeCounts.size) {
    const decs = Array.from(decadeCounts.keys());
    const minDec = Math.min(...decs);
    const maxDec = Math.max(...decs);
    for (let dec = minDec; dec <= maxDec; dec += 10) {
      decadeStats.push({ decade: dec, count: decadeCounts.get(dec) ?? 0 });
    }
  }

  const histCounts = new Map<number, number>();
  for (let r = 1; r <= 10; r++) histCounts.set(r, 0);
  for (const r of ratings) histCounts.set(r.value, (histCounts.get(r.value) ?? 0) + 1);
  const ratingHistogram = Array.from(histCounts.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => a.rating - b.rating);

  const avgStars = ratings.length ? ratings.reduce((s, r) => s + r.value / 2, 0) / ratings.length : null;

  // Nota medie pe gen (doar din filme notate), top 8 după notă.
  const genreRatings = Array.from(genreRatingCount.entries())
    .map(([name, count]) => ({ name, avg: (genreRatingSum.get(name) ?? 0) / count, count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  // Top / flop filme notate.
  const sortedRated = [...ratedFilms].sort((a, b) => b.rating - a.rating);
  const topRated = sortedRated.slice(0, 5);
  const bottomRated = sortedRated.slice().reverse().slice(0, 5);

  const tvCount = watched.filter((w) => w.mediaType === "tv").length;

  return {
    totalWatched: watched.length,
    totalHours: Math.round(totalMinutes / 60),
    totalLiked: likeCount,
    totalRated: ratings.length,
    avgStars,
    ratingHistogram,
    genreStats,
    decadeStats,
    watchedPerMonth,
    critic: criticCount ? { yours: yourCriticSum / criticCount, tmdb: tmdbCriticSum / criticCount } : null,
    moviesCount: watched.length - tvCount,
    tvCount,
    topRated,
    bottomRated,
    genreRatings,
  };
}
