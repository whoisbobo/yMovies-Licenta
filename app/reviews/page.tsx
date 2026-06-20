/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getCachedMovieDetails } from "../../lib/tmdbCache";
import { toTmdbLang } from "../../lib/locale";
import DeleteButton from "../movie/[id]/DeleteButton";

export default async function MyReviewsPage() {
  const { userId } = await auth();
  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);
  const t = await getTranslations("MyReviews");
  const tCommon = await getTranslations("Common");

  if (!userId) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  const reviews = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const detailedReviews = await Promise.all(
    reviews.map(async (review) => {
      const details: any = await getCachedMovieDetails(review.movieId, review.mediaType, tmdbLang);
      return { review, details };
    })
  );

  return (
    <main className="p-8 max-w-4xl mx-auto flex-1 w-full flex flex-col">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {t("title", { count: reviews.length })}
      </h2>

      {reviews.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {detailedReviews.map(({ review, details }) => {
            const title = details?.title || details?.name || t("unknownTitle");
            const isTv = review.mediaType === "tv";

            return (
              <div
                key={review.id}
                className="flex gap-4 bg-[#1f1f1f] p-4 rounded-lg border border-zinc-800"
              >
                <Link
                  href={`/movie/${review.movieId}?type=${review.mediaType}`}
                  className="flex-shrink-0 w-20 sm:w-24"
                >
                  {details?.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${details.poster_path}`}
                      alt={title}
                      className="w-full rounded-lg object-cover aspect-[2/3] hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs text-center p-1">
                      {tCommon("noPoster")}
                    </div>
                  )}
                </Link>

                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-3">
                    <Link
                      href={`/movie/${review.movieId}?type=${review.mediaType}`}
                      className="font-semibold text-lg text-zinc-200 hover:text-yellow-500 transition-colors"
                    >
                      {title}{" "}
                      {isTv && (
                        <span className="text-xs text-zinc-500 font-normal">
                          ({tCommon("tvShowBadge")})
                        </span>
                      )}
                    </Link>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="bg-zinc-900 px-3 py-1 rounded text-yellow-500 font-bold text-sm">
                        ★ {(review.rating / 2).toFixed(1)}
                      </div>
                      <DeleteButton reviewId={review.id} />
                    </div>
                  </div>

                  <p className="text-xs text-zinc-500 mt-1">
                    {new Date(review.createdAt).toLocaleDateString(tmdbLang)}
                  </p>

                  {review.comment && (
                    <p className="text-zinc-300 mt-3 leading-relaxed">{review.comment}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
