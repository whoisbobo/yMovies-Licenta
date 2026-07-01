/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getRecommendations, FREE_TIER_LIMIT } from "../../lib/recommendations";

export default async function RecommendationsPage() {
  const { userId } = await auth();
  const lang = await getLocale();
  const t = await getTranslations("Recommendations");
  const tCommon = await getTranslations("Common");

  if (!userId) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  const isPremium = dbUser?.isPremium ?? false;

  const { recommendations, topGenres, hasEnoughData } = await getRecommendations(userId, lang, isPremium);

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400/20 to-amber-500/10 ring-1 ring-yellow-500/30">
            <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l1.9 5.4L19 9l-5.1 1.6L12 16l-1.9-5.4L5 9l5.1-1.6L12 2zM19 14l.9 2.6L22 17.5l-2.1.9L19 21l-.9-2.6L16 17.5l2.1-.9L19 14zM5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7L5 15z" />
            </svg>
          </span>
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight">{t("title")}</h1>
            {hasEnoughData && (
              <p className="text-sm text-zinc-500">{t("countLabel", { count: recommendations.length })}</p>
            )}
          </div>
        </div>

        {hasEnoughData && topGenres.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mt-5">
            <span className="text-sm text-zinc-400">{t("basedOnTaste")}</span>
            {topGenres.map((genre) => (
              <span
                key={genre}
                className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 text-xs font-semibold"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </header>

      {!hasEnoughData ? (
        <div className="flex flex-col items-center justify-center text-center mt-16 gap-4">
          <svg className="w-14 h-14 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.4L19 10l-5.1 1.6L12 17l-1.9-5.4L5 10l5.1-1.6L12 3z" />
          </svg>
          <p className="text-zinc-500 text-lg italic max-w-md">{t("noData")}</p>
        </div>
      ) : (
        <>
          {!isPremium && recommendations.length >= FREE_TIER_LIMIT && (
            <div className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <p className="text-zinc-200 text-sm">{t("freeLimitNotice", { count: FREE_TIER_LIMIT })}</p>
              </div>
              <Link
                href="/premium"
                className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-zinc-900 px-5 py-2.5 rounded-lg font-bold whitespace-nowrap transition-all shadow-lg shadow-yellow-500/20"
              >
                {t("upgradeButton")}
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {recommendations.map((movie) => (
              <Link
                href={`/movie/${movie.id}?type=${movie.mediaType}`}
                key={`${movie.mediaType}-${movie.id}`}
                className="group relative block rounded-xl overflow-hidden aspect-[2/3] shadow-lg ring-1 ring-zinc-800/80 transition-all duration-300 hover:ring-yellow-500/50 hover:shadow-yellow-500/10 hover:-translate-y-1"
              >
                {movie.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
                    alt={movie.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500 text-sm">
                    {tCommon("noPoster")}
                  </div>
                )}

                {/* Gradient permanent pentru lizibilitatea textului de jos */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

                {/* Badge rating */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-yellow-400 px-2 py-1 rounded-full text-xs font-bold ring-1 ring-white/10">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.3 4.02a1 1 0 00.95.69h4.23c.97 0 1.37 1.24.59 1.81l-3.43 2.49a1 1 0 00-.36 1.12l1.31 4.03c.3.92-.76 1.68-1.54 1.11l-3.43-2.49a1 1 0 00-1.18 0l-3.43 2.49c-.78.57-1.84-.19-1.54-1.11l1.31-4.03a1 1 0 00-.36-1.12L2.03 9.46c-.78-.57-.38-1.81.59-1.81h4.23a1 1 0 00.95-.69l1.3-4.02z" />
                  </svg>
                  {movie.voteAverage.toFixed(1)}
                </div>

                {/* Info jos */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-yellow-400/90 mb-1">
                    {movie.matchedGenre}
                  </span>
                  <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-yellow-400 transition-colors">
                    {movie.title}
                  </h3>
                  {movie.year && <span className="text-xs text-zinc-400">{movie.year}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
