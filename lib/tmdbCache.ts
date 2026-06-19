import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

function isCompleteMovieData(data: unknown): data is JsonRecord {
  if (!data || typeof data !== "object") return false;
  const overview = (data as JsonRecord).overview;
  return typeof overview === "string" && overview.length > 0;
}

/**
 * Cache permanent (cache-aside) pentru pagina de detaliu a unui film/serial.
 * Odată ce avem date complete de la TMDB, nu mai re-fetch-uim niciodată.
 */
export async function getCachedMovieDetails(
  movieId: number,
  mediaType: "movie" | "tv",
  lang: string
): Promise<JsonRecord | null> {
  const key = `movie:${mediaType}:${movieId}:${lang}`;
  const cached = await prisma.pageCache.findUnique({ where: { key } });
  const cachedData = cached?.data as JsonRecord | undefined;

  if (isCompleteMovieData(cachedData)) {
    return cachedData;
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${process.env.TMDB_API_KEY}&language=${encodeURIComponent(lang)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return cachedData ?? null;
    const data = await res.json();

    await prisma.pageCache.upsert({
      where: { key },
      update: { data: data as Prisma.InputJsonValue },
      create: { key, data: data as Prisma.InputJsonValue },
    });

    return data;
  } catch {
    return cachedData ?? null;
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = HOUR_MS;

// TTL-uri diferențiate per tip de listă: cele cu conținut stabil (popular, genre)
// pot fi cache-uite mult mai mult timp decât căutările, care variază per query.
export const TTL = {
  POPULAR: 12 * HOUR_MS,
  GENRE: 12 * HOUR_MS,
  SEARCH: 2 * HOUR_MS,
} as const;

/**
 * Pentru liste de discovery (popular, search, genre, tv).
 * Citește din cache dacă e mai nou decât maxAgeMs — nu mai bate la TMDB la fiecare cerere.
 * Dacă cache-ul e expirat, face fetch live; dacă acela eșuează, servește ultimul rezultat
 * cunoscut (chiar dacă e mai vechi decât maxAgeMs) ca să nu rămână pagina goală.
 */
export async function getWithFallback<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): Promise<T | null> {
  const cached = await prisma.pageCache.findUnique({ where: { key } });

  if (cached) {
    const age = Date.now() - cached.updatedAt.getTime();
    if (age < maxAgeMs) {
      return cached.data as T;
    }
  }

  try {
    const data = await fetcher();
    await prisma.pageCache.upsert({
      where: { key },
      update: { data: data as unknown as Prisma.InputJsonValue },
      create: { key, data: data as unknown as Prisma.InputJsonValue },
    });
    return data;
  } catch {
    return (cached?.data as T) ?? null;
  }
}
