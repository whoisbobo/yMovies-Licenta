/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "../../../../lib/prisma";
import { toTmdbLang } from "../../../../lib/locale";
import { getCachedMovieDetails } from "../../../../lib/tmdbCache";

// Notă 1..10 → steluțe (★ pline + ½), pe scară de 5.
function renderStars(rating10: number): string {
  const stars = rating10 / 2;
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
}

export default async function UserWatchedPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);
  const t = await getTranslations("Watched");
  const tCommon = await getTranslations("Common");

  const target = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    select: { id: true, username: true, displayName: true },
  });
  if (!target) notFound();

  const name = target.displayName || target.username;

  const [watched, ratings, likes] = await Promise.all([
    prisma.watched.findMany({ where: { userId: target.id }, orderBy: { createdAt: "desc" } }),
    prisma.rating.findMany({ where: { userId: target.id }, select: { movieId: true, mediaType: true, value: true } }),
    prisma.like.findMany({ where: { userId: target.id }, select: { movieId: true, mediaType: true } }),
  ]);

  const ratingMap = new Map(ratings.map((r) => [`${r.mediaType}:${r.movieId}`, r.value]));
  const likedSet = new Set(likes.map((l) => `${l.mediaType}:${l.movieId}`));

  const detailed = await Promise.all(
    watched.map(async (item) => {
      const details: any = await getCachedMovieDetails(item.movieId, item.mediaType, tmdbLang);
      const key = `${item.mediaType}:${item.movieId}`;
      return {
        item,
        details,
        rating: ratingMap.get(key) ?? null,
        isLiked: likedSet.has(key),
      };
    })
  );

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full">
      <Link href={`/users/${target.username}`} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
        ← {name}
      </Link>
      <h2 className="text-2xl font-semibold mt-2 mb-6 border-l-4 border-yellow-500 pl-3">
        {t("userTitle", { name })}
      </h2>

      {detailed.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">{t("emptyOther")}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-6">
          {detailed.map(({ item, details, rating, isLiked }) => {
            const title = details?.title || details?.name || t("unknownTitle");
            return (
              <div key={`${item.mediaType}-${item.movieId}`} className="flex flex-col">
                <Link href={`/movie/${item.movieId}?type=${item.mediaType}`} title={title}>
                  {details?.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${details.poster_path}`}
                      alt={title}
                      className="w-full rounded object-cover aspect-[2/3] border border-white/10 hover:border-yellow-500/60 transition-colors"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-[10px] text-center p-1">
                      {tCommon("noPoster")}
                    </div>
                  )}
                </Link>

                {(rating !== null || isLiked) && (
                  <div className="flex items-center leading-none gap-2 mt-2 text-base">
                    {rating !== null && (
                      <span className="text-yellow-500 tracking-tight">{renderStars(rating)}</span>
                    )}
                    {isLiked && (
                      <svg className="text-rose-400 w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
