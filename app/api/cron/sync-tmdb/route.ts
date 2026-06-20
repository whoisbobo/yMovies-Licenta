import { NextResponse } from "next/server";
import { refreshCache } from "../../../../lib/tmdbCache";
import { SUPPORTED_LOCALES, toTmdbLang } from "../../../../lib/locale";

export const dynamic = "force-dynamic";

async function fetchTmdbResults(endpoint: string): Promise<unknown[]> {
  const res = await fetch(endpoint, { cache: "no-store" });
  if (!res.ok) throw new Error(`TMDB a răspuns cu ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

/**
 * Job de sync periodic (declanșat de Vercel Cron, vezi vercel.json).
 * Reîmprospătează listele "populare" pentru toate limbile suportate,
 * indiferent de cât de "proaspăt" e considerat cache-ul curent (bypass TTL).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refreshed: string[] = [];
  const failed: { key: string; error: string }[] = [];

  for (const locale of SUPPORTED_LOCALES) {
    const tmdbLang = toTmdbLang(locale);

    const jobs: { key: string; endpoint: string }[] = [
      {
        key: `discover:popular:1:${tmdbLang}`,
        endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&sort_by=popularity.desc&vote_count.gte=200&page=1`,
      },
      {
        key: `discover:tv-popular:1:${tmdbLang}`,
        endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&sort_by=popularity.desc&vote_count.gte=200&page=1`,
      },
    ];

    for (const job of jobs) {
      try {
        await refreshCache(job.key, () => fetchTmdbResults(job.endpoint));
        refreshed.push(job.key);
      } catch (error) {
        failed.push({ key: job.key, error: (error as Error).message });
      }
    }
  }

  return NextResponse.json({
    refreshed,
    failed,
    timestamp: new Date().toISOString(),
  });
}
