import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

function isCompleteMovieData(data: unknown): data is JsonRecord {
  if (!data || typeof data !== "object") return false;
  const overview = (data as JsonRecord).overview;
  return typeof overview === "string" && overview.length > 0;
}

/**
 * TMDB are instabilități intermitente la serviciul lor de traducere pentru anumite
 * limbi (502 "Couldn't connect to the backend server"), aleatorii și nelegate de
 * cheia noastră — en-US e mereu stabil pentru că nu trece prin acel serviciu.
 * Reîncercăm cu en-US ca fallback, ca utilizatorul să vadă conținut (în engleză)
 * în loc de o pagină goală când limba localizată e indisponibilă temporar.
 */
export async function fetchTmdbWithFallback(pathAndQuery: string, lang: string): Promise<Response> {
  const url = `https://api.themoviedb.org/3${pathAndQuery}&language=${encodeURIComponent(lang)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.ok || lang === "en-US") return res;

  const fallbackUrl = `https://api.themoviedb.org/3${pathAndQuery}&language=en-US`;
  return fetch(fallbackUrl, { cache: "no-store" });
}

/**
 * TMDB nu ține postere în română aproape niciodată — câmpul poster_path din
 * /movie/{id} poate reveni la orice poster are cel mai mare scor intern,
 * inclusiv unul cu text într-o limbă complet aleatorie (ex. rusă). Cerem explicit
 * un poster fără text localizat-greșit: în engleză sau fără text deloc (textless).
 */
async function getSafePosterPath(
  movieId: number,
  mediaType: "movie" | "tv",
  fallback: string | null
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${movieId}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en,null`,
      { cache: "no-store" }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const posters = (data.posters || []) as { file_path: string }[];
    return posters[0]?.file_path ?? fallback;
  } catch {
    return fallback;
  }
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
    const res = await fetchTmdbWithFallback(
      `/${mediaType}/${movieId}?api_key=${process.env.TMDB_API_KEY}`,
      lang
    );
    if (!res.ok) return cachedData ?? null;
    const data = await res.json();
    data.poster_path = await getSafePosterPath(movieId, mediaType, data.poster_path ?? null);

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
// POPULAR/GENRE = 24h, aliniat cu cron-ul zilnic de sync (vezi vercel.json):
// cron-ul reîmprospătează la 4 UTC, iar TTL-ul acoperă exact intervalul până la
// următoarea rulare — fără fereastră în care cache-ul e considerat expirat.
export const TTL = {
  POPULAR: 24 * HOUR_MS,
  GENRE: 24 * HOUR_MS,
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

/**
 * Refresh forțat, fără verificare de TTL — folosit de job-ul de sync periodic (cron),
 * care trebuie să actualizeze cache-ul indiferent de cât de "proaspăt" e considerat.
 */
export async function refreshCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const data = await fetcher();
  await prisma.pageCache.upsert({
    where: { key },
    update: { data: data as unknown as Prisma.InputJsonValue },
    create: { key, data: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}
