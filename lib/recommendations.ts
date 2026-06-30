import { prisma } from "./prisma";
import { getCachedMovieDetails, fetchTmdbWithFallback } from "./tmdbCache";
import { toTmdbLang } from "./locale";

type GenreScore = { id: number; name: string; score: number; count: number };

const FREE_TIER_LIMIT = 3;
const PREMIUM_TIER_LIMIT = 15;
const TOP_GENRES_COUNT = 3;

/**
 * Analizează istoricul de rating-uri al userului și calculează afinitatea
 * pe genuri TMDB: suma rating-urilor date filmelor/serialelor din acel gen.
 * Genurile vin din datele deja cache-uite (PageCache), nu necesită cereri noi.
 */
async function computeGenreAffinity(
  userId: string,
  lang: string
): Promise<GenreScore[]> {
  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: { value: true, movieId: true, mediaType: true },
  });

  const genreScores = new Map<number, GenreScore>();

  await Promise.all(
    ratings.map(async (rating) => {
      const details = await getCachedMovieDetails(rating.movieId, rating.mediaType, lang);
      const genres = (details as { genres?: { id: number; name: string }[] } | null)?.genres;
      if (!genres) return;

      for (const genre of genres) {
        const existing = genreScores.get(genre.id);
        if (existing) {
          existing.score += rating.value;
          existing.count += 1;
        } else {
          genreScores.set(genre.id, { id: genre.id, name: genre.name, score: rating.value, count: 1 });
        }
      }
    })
  );

  return Array.from(genreScores.values()).sort((a, b) => b.score - a.score);
}

export type Recommendation = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  voteAverage: number;
  matchedGenre: string;
};

export async function getRecommendations(
  userId: string,
  lang: string,
  isPremium: boolean
): Promise<{ recommendations: Recommendation[]; topGenres: string[]; hasEnoughData: boolean }> {
  const tmdbLang = toTmdbLang(lang);
  const genreScores = await computeGenreAffinity(userId, tmdbLang);

  if (genreScores.length === 0) {
    return { recommendations: [], topGenres: [], hasEnoughData: false };
  }

  const topGenres = genreScores.slice(0, TOP_GENRES_COUNT);
  const limit = isPremium ? PREMIUM_TIER_LIMIT : FREE_TIER_LIMIT;

  // Excludem tot ce a "atins" deja userul: notate, văzute și din watchlist —
  // ca să nu-i recomandăm filme pe care le-a văzut sau și le-a pus deja în plan.
  const [ratedItems, watchedItems, watchlistItems] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, select: { movieId: true, mediaType: true } }),
    prisma.watched.findMany({ where: { userId }, select: { movieId: true, mediaType: true } }),
    prisma.watchlistItem.findMany({ where: { userId }, select: { movieId: true, mediaType: true } }),
  ]);
  const excludeSet = new Set(
    [...ratedItems, ...watchedItems, ...watchlistItems].map((r) => `${r.mediaType}:${r.movieId}`)
  );

  const seen = new Set<string>();
  const recommendations: Recommendation[] = [];

  // Cotă per gen, ca topGenres[0] (cel mai bine notat) să nu acapareze tot
  // plafonul — fiecare gen din top 3 contribuie cu un număr egal de recomandări.
  const perGenreQuota = Math.ceil(limit / topGenres.length);
  const genreResults = new Map<number, any[]>();

  for (const genre of topGenres) {
    const res = await fetchTmdbWithFallback(
      `/discover/movie?api_key=${process.env.TMDB_API_KEY}&with_genres=${genre.id}&sort_by=popularity.desc&vote_count.gte=200&page=1`,
      tmdbLang
    );
    if (!res.ok) {
      genreResults.set(genre.id, []);
      continue;
    }
    const data = await res.json();
    genreResults.set(genre.id, data.results || []);
  }

  const pushFromGenre = (genre: GenreScore, quota: number) => {
    let added = 0;
    for (const movie of genreResults.get(genre.id) || []) {
      if (added >= quota || recommendations.length >= limit) break;
      const key = `movie:${movie.id}`;
      if (excludeSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      added++;

      recommendations.push({
        id: movie.id,
        mediaType: "movie",
        title: movie.title || movie.name,
        posterPath: movie.poster_path ?? null,
        voteAverage: movie.vote_average ?? 0,
        matchedGenre: genre.name,
      });
    }
  };

  for (const genre of topGenres) {
    pushFromGenre(genre, perGenreQuota);
  }

  // Al doilea pas: dacă vreun gen n-a avut suficiente filme noi pentru cota lui,
  // completăm locurile rămase din celelalte genuri (fără cotă), ca să nu lăsăm
  // sloturi goale doar pentru că un gen a avut rezultate puține/excluse.
  if (recommendations.length < limit) {
    for (const genre of topGenres) {
      pushFromGenre(genre, limit);
    }
  }

  return {
    recommendations,
    topGenres: topGenres.map((g) => g.name),
    hasEnoughData: true,
  };
}

export { FREE_TIER_LIMIT, PREMIUM_TIER_LIMIT };
