/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { getWithFallback, fetchTmdbWithFallback, TTL, getCachedMovieDetails } from "../lib/tmdbCache";
import { toTmdbLang } from "../lib/locale";

const POPULAR_COUNT = 6;
const FEED_COUNT = 12;

// Notă 1..10 → "★★★½".
function stars(rating10: number): string {
  const s = rating10 / 2;
  const full = Math.floor(s);
  return "★".repeat(full) + (s - full >= 0.5 ? "½" : "");
}

export default async function Home() {
  const { userId } = await auth();

  // Sincronizăm userul Clerk în DB la deschiderea paginii principale (fallback-uri unice).
  if (userId) {
    const user = await currentUser();
    if (user) {
      const uname = user.username || `user_${userId.replace(/^user_/, "")}`;
      const email = user.emailAddresses[0]?.emailAddress || `${userId}@no-email.local`;
      await prisma.user.upsert({
        where: { id: userId },
        update: { email, username: uname, avatarUrl: user.imageUrl },
        create: { id: userId, email, username: uname, avatarUrl: user.imageUrl },
      });
    }
  }

  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);
  const t = await getTranslations("Home");
  const tCommon = await getTranslations("Common");

  // Filme populare (cache-uit, minim de voturi).
  const popular = await getWithFallback(
    `discover:popular:1:${tmdbLang}`,
    async () => {
      const res = await fetchTmdbWithFallback(
        `/discover/movie?api_key=${process.env.TMDB_API_KEY}&sort_by=popularity.desc&vote_count.gte=200&page=1`,
        tmdbLang
      );
      if (!res.ok) throw new Error("TMDB request failed");
      const data = await res.json();
      return data.results || [];
    },
    TTL.POPULAR
  );
  const popularMovies = (popular || []).slice(0, POPULAR_COUNT);

  // Seriale populare (cache-uit, aceeași cheie ca pagina /tv).
  const popularTvRaw = await getWithFallback(
    `discover:tv-popular:1:${tmdbLang}`,
    async () => {
      const res = await fetchTmdbWithFallback(
        `/discover/tv?api_key=${process.env.TMDB_API_KEY}&sort_by=popularity.desc&vote_count.gte=200&page=1`,
        tmdbLang
      );
      if (!res.ok) throw new Error("TMDB request failed");
      const data = await res.json();
      return data.results || [];
    },
    TTL.POPULAR
  );
  const popularTv = (popularTvRaw || []).slice(0, POPULAR_COUNT);

  // Feed global: cele mai recente recenzii ale tuturor userilor.
  const recentReviews = await prisma.review.findMany({
    where: { comment: { not: null } },
    orderBy: { createdAt: "desc" },
    take: FEED_COUNT,
    include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
  });

  const ratingRows = recentReviews.length
    ? await prisma.rating.findMany({
        where: { OR: recentReviews.map((r) => ({ userId: r.userId, movieId: r.movieId, mediaType: r.mediaType })) },
        select: { userId: true, movieId: true, mediaType: true, value: true },
      })
    : [];
  const ratingMap = new Map(ratingRows.map((r) => [`${r.userId}:${r.mediaType}:${r.movieId}`, r.value]));

  const feed = await Promise.all(
    recentReviews.map(async (review) => {
      const details: any = await getCachedMovieDetails(review.movieId, review.mediaType, tmdbLang);
      return {
        review,
        details,
        rating: ratingMap.get(`${review.userId}:${review.mediaType}:${review.movieId}`) ?? null,
      };
    })
  );

  return (
    <main className="p-4 sm:p-8 max-w-7xl mx-auto flex-1 w-full">
      {/* Hero */}
      <div className="text-center py-8 mb-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.2] bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent inline-block px-1 pb-2">
          yMovies
        </h1>
        <p className="text-zinc-400 mt-3 max-w-xl mx-auto">{t("heroSubtitle")}</p>
      </div>

      {/* Filme populare */}
      <section className="mb-12">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">{t("popularMovies")}</h2>
          <Link href="/movies" className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
            {t("seeAll")}
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {popularMovies.map((movie: any) => (
            <Link href={`/movie/${movie.id}?type=movie`} key={movie.id} className="group flex flex-col gap-2" title={movie.title}>
              <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 aspect-[2/3]">
                {movie.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs">{tCommon("noPoster")}</div>
                )}
                <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-0.5 rounded text-xs font-bold shadow">
                  ★ {movie.vote_average?.toFixed(1) || "0.0"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Seriale populare */}
      <section className="mb-14">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">{t("popularTv")}</h2>
          <Link href="/tv" className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
            {t("seeAll")}
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {popularTv.map((show: any) => (
            <Link href={`/movie/${show.id}?type=tv`} key={show.id} className="group flex flex-col gap-2" title={show.name}>
              <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 aspect-[2/3]">
                {show.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w500${show.poster_path}`} alt={show.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs">{tCommon("noPoster")}</div>
                )}
                <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-0.5 rounded text-xs font-bold shadow">
                  ★ {show.vote_average?.toFixed(1) || "0.0"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Feed global de recenzii */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400 border-b border-zinc-800 pb-2 mb-5">
          {t("recentActivityFeed")}
        </h2>
        {feed.length === 0 ? (
          <p className="text-zinc-500 text-sm italic">{t("feedEmpty")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {feed.map(({ review, details, rating }) => {
              const title = details?.title || details?.name || "—";
              return (
                <div key={review.id} className="flex gap-4 bg-[#1f1f1f] p-3 rounded-lg border border-zinc-800">
                  <Link href={`/movie/${review.movieId}?type=${review.mediaType}`} className="flex-shrink-0 w-14">
                    {details?.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w200${details.poster_path}`} alt={title} className="w-full rounded object-cover aspect-[2/3] hover:opacity-80 transition-opacity" />
                    ) : (
                      <div className="w-full aspect-[2/3] rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-[10px] text-center p-1">{tCommon("noPoster")}</div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/users/${review.user.username}`} className="flex items-center gap-1.5 group">
                        {review.user.avatarUrl ? (
                          <img src={review.user.avatarUrl} alt={review.user.username} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                            {review.user.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-zinc-200 group-hover:text-yellow-500 transition-colors">
                          {review.user.displayName || review.user.username}
                        </span>
                      </Link>
                      {rating !== null && <span className="text-yellow-500 text-xs">{stars(rating)}</span>}
                    </div>
                    <Link href={`/movie/${review.movieId}?type=${review.mediaType}`} className="text-xs text-zinc-500 hover:text-yellow-500 transition-colors">
                      {title}
                    </Link>
                    {review.hasSpoiler ? (
                      <p className="text-yellow-500/80 text-sm mt-1 italic">⚠ {t("feedSpoiler")}</p>
                    ) : (
                      review.comment && <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{review.comment}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
