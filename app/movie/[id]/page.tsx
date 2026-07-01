/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import ReviewForm from "./ReviewForm";
import { prisma } from "../../../lib/prisma";
import DeleteButton from "./DeleteButton";
import MovieActionBar from "./MovieActionBar";
import RatingControl from "./RatingControl";
import SpoilerComment from "./SpoilerComment";
import ReviewSocial from "./ReviewSocial";
import { type ReviewCommentDTO } from "../../actions";
import { getTranslations, getLocale } from "next-intl/server";
import { movieIdParamSchema, mediaTypeParamSchema } from "../../../lib/validation";
import { notFound } from "next/navigation";
import { getCachedMovieDetails } from "../../../lib/tmdbCache";
import { toTmdbLang } from "../../../lib/locale";

async function getMovieDetails(id: number, type: string, lang: string = "ro") {
  const endpointType = type === "tv" ? "tv" : "movie";
  const tmdbLang = toTmdbLang(lang);
  return getCachedMovieDetails(id, endpointType, tmdbLang);
}

function formatDuration(minutes: number | undefined, t: (key: string, values?: Record<string, number>) => string): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? t("durationHM", { h: hours, m: mins }) : t("durationM", { m: mins });
}

export default async function MoviePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const parsedMovieId = movieIdParamSchema.safeParse(resolvedParams.id);
  if (!parsedMovieId.success) notFound();
  const movieId = parsedMovieId.data;
  const contentType = mediaTypeParamSchema.parse(resolvedSearchParams.type);

  const lang = await getLocale();
  const t = await getTranslations("MovieDetail");

  const movie: any = await getMovieDetails(movieId, contentType, lang);
  const { userId } = await auth();

  if (!movie) {
    return <div className="text-white text-center mt-20 text-2xl">{t("notFound")}</div>;
  }

  const title = movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date;
  const runtimeMinutes = contentType === "tv" ? movie.episode_run_time?.[0] : movie.runtime;
  const durationLabel = formatDuration(runtimeMinutes, t);
  const dbUser = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  // AICI AM MODIFICAT: Acum filtrăm recenziile folosind și tipul media!
  const [reviews, movieRatings] = await Promise.all([
    prisma.review.findMany({
      where: { movieId, mediaType: contentType },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.rating.findMany({
      where: { movieId, mediaType: contentType },
      select: { userId: true, value: true },
    }),
  ]);

  // Notele filmului, indexate după userId — recenzia și nota sunt separate acum.
  const ratingByUser = new Map(movieRatings.map((r) => [r.userId, r.value]));

  // Like-uri și comentarii pe recenzii (în bulk, ca să evităm N+1).
  const reviewIds = reviews.map((r) => r.id);
  const [reviewLikes, reviewComments] = reviewIds.length
    ? await Promise.all([
        prisma.reviewLike.findMany({ where: { reviewId: { in: reviewIds } }, select: { reviewId: true, userId: true } }),
        prisma.reviewComment.findMany({
          where: { reviewId: { in: reviewIds } },
          orderBy: { createdAt: "asc" },
          include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
        }),
      ])
    : [[], []];

  const likeCountByReview = new Map<number, number>();
  const likedByMe = new Set<number>();
  for (const l of reviewLikes) {
    likeCountByReview.set(l.reviewId, (likeCountByReview.get(l.reviewId) ?? 0) + 1);
    if (l.userId === userId) likedByMe.add(l.reviewId);
  }
  const commentsByReview = new Map<number, ReviewCommentDTO[]>();
  for (const c of reviewComments) {
    const dto: ReviewCommentDTO = {
      id: c.id,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      userId: c.userId,
      username: c.user.username,
      displayName: c.user.displayName,
      avatarUrl: c.user.avatarUrl,
    };
    const arr = commentsByReview.get(c.reviewId) ?? [];
    arr.push(dto);
    commentsByReview.set(c.reviewId, arr);
  }

  const compoundKey = userId
    ? { userId: userId as string, movieId, mediaType: contentType }
    : null;

  const [watchlistItem, watchedItem, likeItem] = compoundKey
    ? await Promise.all([
        prisma.watchlistItem.findUnique({ where: { userId_movieId_mediaType: compoundKey } }),
        prisma.watched.findUnique({ where: { userId_movieId_mediaType: compoundKey } }),
        prisma.like.findUnique({ where: { userId_movieId_mediaType: compoundKey } }),
      ])
    : [null, null, null];

  const inWatchlist = !!watchlistItem;
  const isWatched = !!watchedItem;
  const isLiked = !!likeItem;
  const myRating = userId ? ratingByUser.get(userId) ?? 0 : 0;
  const hasReviewOrRating = myRating > 0 || (userId ? reviews.some((r) => r.userId === userId) : false);

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col md:flex-row gap-12 flex-1 w-full">
      <div className="w-full md:w-1/3 flex-shrink-0">
        <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={title} className="w-full rounded-xl shadow-2xl shadow-yellow-500/10 border border-zinc-800" />
      </div>

      <div className="w-full md:w-2/3 flex flex-col justify-center">
        <h1 className="text-5xl font-extrabold mb-4">{title}</h1>

        <div className="flex gap-4 items-center mb-6 text-zinc-400 font-medium">
          <span className="bg-yellow-500 text-zinc-900 px-3 py-1 rounded font-bold">★ {movie.vote_average?.toFixed(1) || "0.0"}</span>
          <span>{releaseDate?.substring(0, 4)}</span>
          {durationLabel && <span>{durationLabel}</span>}
          <span className="flex gap-2">{movie.genres?.map((g: any) => g.name).join(", ")}</span>
        </div>

        <p className="text-lg text-zinc-300 leading-relaxed mb-8">
          {movie.overview || t("noDescription")}
        </p>

        {userId && (
          <div className="mb-6 space-y-4">
            <RatingControl movieId={movie.id} movieTitle={title} mediaType={contentType} initialRating={myRating} />
            <MovieActionBar
              movieId={movie.id}
              movieTitle={title}
              mediaType={contentType}
              initialInWatchlist={inWatchlist}
              initialIsWatched={isWatched}
              initialIsLiked={isLiked}
              hasReviewOrRating={hasReviewOrRating}
            />
          </div>
        )}

        <div className="border-t border-zinc-800 pt-8 mt-auto">
          <h3 className="text-xl font-bold text-yellow-500 mb-6">{t("reviewsSection")}</h3>

          {!userId ? (
            <p className="text-zinc-500 bg-[#1f1f1f] p-4 rounded-lg border border-zinc-800 mb-12">
              {t("mustLogin")}
            </p>
          ) : (
            <div className="mb-12">
              {/* AICI AM MODIFICAT: Trimitem și mediaType către formular */}
              <ReviewForm movieId={movie.id} movieTitle={title} mediaType={contentType} />
            </div>
          )}

          <div className="space-y-6">
            <h4 className="text-lg font-bold text-zinc-300 border-b border-zinc-800 pb-2">
              {t("userOpinions", { count: reviews.length })}
            </h4>

            {reviews.length === 0 ? (
              <p className="text-zinc-500 italic">{t("noReviews")}</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-[#1f1f1f] p-5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-start mb-4">
                    <Link href={`/users/${review.user.username}`} className="flex items-center gap-3 group">
                      {review.user.avatarUrl ? (
                        <img src={review.user.avatarUrl} alt={review.user.username} className="w-10 h-10 rounded-full border border-zinc-700 object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center font-bold text-zinc-500">{review.user.username.substring(0, 2).toUpperCase()}</div>
                      )}
                      <div>
                        <p className="font-semibold text-zinc-200 group-hover:text-yellow-500 transition-colors">{review.user.displayName || review.user.username}</p>
                        <p className="text-xs text-zinc-500">{new Date(review.createdAt).toLocaleDateString(toTmdbLang(lang))}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3">
                      {ratingByUser.has(review.userId) && (
                        <div className="bg-zinc-900 px-3 py-1 rounded text-yellow-500 font-bold">★ {(ratingByUser.get(review.userId)! / 2).toFixed(1)}</div>
                      )}
                      {(dbUser?.role === "ADMIN" || dbUser?.id === review.userId) && <DeleteButton reviewId={review.id} />}
                    </div>
                  </div>
                  <SpoilerComment text={review.comment ?? ""} isSpoiler={review.hasSpoiler && review.userId !== userId} />

                  <ReviewSocial
                    reviewId={review.id}
                    initialLikeCount={likeCountByReview.get(review.id) ?? 0}
                    initialLiked={likedByMe.has(review.id)}
                    initialComments={commentsByReview.get(review.id) ?? []}
                    isLoggedIn={!!userId}
                    currentUserId={userId ?? null}
                    isAdmin={dbUser?.role === "ADMIN"}
                    isReviewOwner={review.userId === userId}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}