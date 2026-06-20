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
      <h2 className="text-2xl font-semibold mb-2 border-l-4 border-yellow-500 pl-3">
        {t("title")}
      </h2>

      {hasEnoughData && (
        <p className="text-zinc-500 mb-8 pl-4">
          {t("subtitle", { genres: topGenres.join(", ") })}
        </p>
      )}

      {!hasEnoughData ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">
          {t("noData")}
        </div>
      ) : (
        <>
          {!isPremium && recommendations.length >= FREE_TIER_LIMIT && (
            <div className="bg-[#1f1f1f] border border-yellow-500/30 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-zinc-300">{t("freeLimitNotice", { count: FREE_TIER_LIMIT })}</p>
              <Link
                href="/premium"
                className="bg-yellow-500 hover:bg-yellow-400 text-zinc-900 px-5 py-2 rounded-lg font-bold whitespace-nowrap transition-colors"
              >
                {t("upgradeButton")}
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {recommendations.map((movie) => (
              <Link
                href={`/movie/${movie.id}?type=${movie.mediaType}`}
                key={`${movie.mediaType}-${movie.id}`}
                className="group cursor-pointer flex flex-col gap-2"
              >
                <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 aspect-[2/3]">
                  {movie.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-sm">
                      {tCommon("noPoster")}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-1 rounded text-xs font-bold shadow">
                    ★ {movie.voteAverage.toFixed(1)}
                  </div>
                </div>
                <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors">
                  {movie.title}
                </h3>
                <span className="text-xs text-zinc-500 italic">
                  {t("matchedGenre", { genre: movie.matchedGenre })}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
