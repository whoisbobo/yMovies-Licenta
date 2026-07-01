/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getCachedMovieDetails } from "../../lib/tmdbCache";
import { toTmdbLang } from "../../lib/locale";
import { getRatingHistogram } from "../../lib/stats";
import { FAVORITE_LIMIT } from "../../lib/constants";
import { type FavoriteSlot } from "./FavoritesEditor";
import FollowButton from "../users/FollowButton";
import { getActivityFeed } from "../../lib/activity";
import ActivityList from "./ActivityList";
import DiaryTable, { getDiaryEntries } from "../diary/DiaryTable";

const RECENT_REVIEWS_COUNT = 5;
const WATCHLIST_PREVIEW_COUNT = 5;
const RECENT_ACTIVITY_COUNT = 4;
const ACTIVITY_FEED_COUNT = 6;
const DIARY_PREVIEW_COUNT = 8;

export default async function ProfileContent({
  targetUserId,
  viewerUserId,
}: {
  targetUserId: string;
  viewerUserId: string | null;
}) {
  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);
  const t = await getTranslations("Profile");
  const tCommon = await getTranslations("Common");
  const tActivity = await getTranslations("Activity");
  const tDiary = await getTranslations("Diary");
  const tReviewForm = await getTranslations("ReviewForm");

  const dbUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!dbUser) {
    return <main className="p-8 text-center mt-20 text-xl text-zinc-400">{t("notFound")}</main>;
  }

  const isOwn = viewerUserId === targetUserId;
  const watchlistHref = isOwn ? "/watchlist" : `/users/${dbUser.username}/watchlist`;
  const diaryHref = isOwn ? "/diary" : `/users/${dbUser.username}/diary`;

  const [
    favorites,
    recentReviews,
    likes,
    ratings,
    watchedCount,
    watchlistCount,
    watchlistPreview,
    ratingHistogram,
    recentWatched,
    followingCount,
    followersCount,
    viewerFollow,
  ] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: targetUserId }, orderBy: { position: "asc" }, take: FAVORITE_LIMIT }),
    prisma.review.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" }, take: RECENT_REVIEWS_COUNT }),
    prisma.like.findMany({ where: { userId: targetUserId }, select: { movieId: true, mediaType: true } }),
    prisma.rating.findMany({ where: { userId: targetUserId }, select: { movieId: true, mediaType: true, value: true } }),
    prisma.watched.count({ where: { userId: targetUserId } }),
    prisma.watchlistItem.count({ where: { userId: targetUserId } }),
    prisma.watchlistItem.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" }, take: WATCHLIST_PREVIEW_COUNT }),
    getRatingHistogram(targetUserId),
    prisma.watched.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" }, take: RECENT_ACTIVITY_COUNT }),
    prisma.follow.count({ where: { followerId: targetUserId } }),
    prisma.follow.count({ where: { followingId: targetUserId } }),
    viewerUserId && !isOwn
      ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerUserId, followingId: targetUserId } } })
      : Promise.resolve(null),
  ]);

  const [activityFeed, diaryPreview] = await Promise.all([
    getActivityFeed(targetUserId, tmdbLang, ACTIVITY_FEED_COUNT),
    getDiaryEntries(targetUserId, tmdbLang, DIARY_PREVIEW_COUNT),
  ]);

  const likedSet = new Set(likes.map((l) => `${l.mediaType}:${l.movieId}`));
  const ratingMap = new Map(ratings.map((r) => [`${r.mediaType}:${r.movieId}`, r.value]));

  const [favoriteSlots, detailedReviews, detailedWatchlistPreview, detailedRecentWatched] = await Promise.all([
    (async () => {
      const slots: FavoriteSlot[] = Array.from({ length: FAVORITE_LIMIT }, () => null);
      await Promise.all(
        favorites.map(async (fav) => {
          const details = (await getCachedMovieDetails(fav.movieId, fav.mediaType, tmdbLang)) as {
            title?: string;
            name?: string;
            poster_path?: string | null;
          } | null;
          if (fav.position >= 0 && fav.position < FAVORITE_LIMIT) {
            slots[fav.position] = {
              movieId: fav.movieId,
              mediaType: fav.mediaType,
              title: details?.title || details?.name || t("unknownTitle"),
              posterPath: details?.poster_path ?? null,
            };
          }
        })
      );
      return slots;
    })(),
    Promise.all(
      recentReviews.map(async (review) => ({
        review,
        details: await getCachedMovieDetails(review.movieId, review.mediaType, tmdbLang),
        isLiked: likedSet.has(`${review.mediaType}:${review.movieId}`),
        rating: ratingMap.get(`${review.mediaType}:${review.movieId}`) ?? null,
      }))
    ),
    Promise.all(
      watchlistPreview.map(async (item) => ({
        item,
        details: await getCachedMovieDetails(item.movieId, item.mediaType, tmdbLang),
      }))
    ),
    Promise.all(
      recentWatched.map(async (item) => ({
        item,
        details: await getCachedMovieDetails(item.movieId, item.mediaType, tmdbLang),
      }))
    ),
  ]);

  const maxRatingCount = Math.max(...ratingHistogram.map((r) => r.count), 1);

  const statBoxes = [
    { label: t("statFilms"), value: watchedCount, href: isOwn ? "/watched" : null as string | null },
    { label: t("statFollowing"), value: followingCount, href: `/users/${dbUser.username}/following` },
    { label: t("statFollowers"), value: followersCount, href: `/users/${dbUser.username}/followers` },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto flex-1 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-6 pb-6 mb-6 border-b border-zinc-800">
        <div className="flex items-center gap-5">
          {dbUser.avatarUrl ? (
            <img
              src={dbUser.avatarUrl}
              alt={dbUser.username}
              className="w-20 h-20 rounded-full border-2 border-yellow-500 object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-yellow-500 flex items-center justify-center text-2xl font-bold text-zinc-400">
              {dbUser.username?.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">{dbUser.displayName || dbUser.username}</h1>
              {dbUser.isPremium && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-zinc-900 text-[10px] font-bold uppercase tracking-wide shadow-sm shadow-yellow-500/20">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {t("premiumBadge")}
                </span>
              )}
              {isOwn ? (
                <Link
                  href="/profile/edit"
                  className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {t("editProfile")}
                </Link>
              ) : viewerUserId ? (
                <FollowButton targetUserId={dbUser.id} initialIsFollowing={!!viewerFollow} size="sm" />
              ) : null}
            </div>
            <p className="text-zinc-500 text-sm">@{dbUser.username}</p>
            {(dbUser.location || dbUser.website) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400 mt-1.5">
                {dbUser.location && (
                  <span className="inline-flex items-center gap-1.5 leading-none">
                    <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                    </svg>
                    <span>{dbUser.location}</span>
                  </span>
                )}
                {dbUser.website && (
                  <a
                    href={dbUser.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 leading-none text-yellow-500 hover:text-yellow-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
                    </svg>
                    <span>{dbUser.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 lg:gap-0 lg:w-72">
          {statBoxes.map((box) => {
            const inner = (
              <>
                <div className="text-xl font-bold text-zinc-100">{box.value}</div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">{box.label}</div>
              </>
            );
            return box.href ? (
              <Link key={box.label} href={box.href} className="text-center hover:opacity-80 transition-opacity">
                {inner}
              </Link>
            ) : (
              <div key={box.label} className="text-center">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      {dbUser.bio && (
        <p className={`text-zinc-300 text-sm leading-relaxed max-w-2xl whitespace-pre-line ${dbUser.favoriteGenres.length > 0 ? "mb-4" : "mb-10"}`}>
          {dbUser.bio}
        </p>
      )}

      {dbUser.favoriteGenres.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {dbUser.favoriteGenres.map((g) => (
            <span key={g} className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
              {g}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Coloana stângă */}
        <div className="flex-1 min-w-0">

      {/* Favorite Films */}
      <section className="mb-12">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400 mb-4 border-b border-zinc-800 pb-2">
          {t("favoritesTitle")}
        </h2>
        <div className="grid grid-cols-4 gap-4 max-w-xl">
          {favoriteSlots.map((slot, index) => {
            const content = slot ? (
              slot.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w300${slot.posterPath}`}
                  alt={slot.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-zinc-500 text-xs text-center p-1">{slot.title}</span>
              )
            ) : null;

            const className =
              "w-full aspect-[2/3] rounded-lg overflow-hidden border-2 border-yellow-500 flex items-center justify-center";

            return slot ? (
              <Link
                key={index}
                href={`/movie/${slot.movieId}?type=${slot.mediaType}`}
                className={`${className} hover:opacity-80 transition-opacity`}
              >
                {content}
              </Link>
            ) : (
              <div key={index} className={className}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Activity (Watched, in order) */}
      <section className="mb-12">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">{t("recentActivityTitle")}</h2>
          <Link href={isOwn ? "/watched" : diaryHref} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
            {t("seeAllReviews")}
          </Link>
        </div>
        {detailedRecentWatched.length === 0 ? (
          <p className="text-zinc-500 text-sm italic">{t("recentActivityEmpty")}</p>
        ) : (
          <div className="grid grid-cols-4 gap-4 max-w-xl">
            {detailedRecentWatched.map(({ item, details }) => {
              const movieDetails = details as any;
              const title = movieDetails?.title || movieDetails?.name || t("unknownTitle");
              return (
                <Link
                  href={`/movie/${item.movieId}?type=${item.mediaType}`}
                  key={`${item.mediaType}-${item.movieId}`}
                  title={title}
                >
                  {movieDetails?.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${movieDetails.poster_path}`}
                      alt={title}
                      className="w-full rounded object-cover aspect-[2/3] hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-[10px] text-center p-1">
                      {tCommon("noPoster")}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

          {/* Recenzii recente */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">{t("recentReviewsTitle")}</h2>
            {isOwn && (
              <Link href="/reviews" className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
                {t("seeAllReviews")}
              </Link>
            )}
          </div>

          {detailedReviews.length === 0 ? (
            <p className="text-zinc-500 text-sm italic">{t("reviewsEmpty")}</p>
          ) : (
            <div className="space-y-4">
              {detailedReviews.map(({ review, details, isLiked, rating }) => {
                const movieDetails = details as any;
                const title = movieDetails?.title || movieDetails?.name || t("unknownTitle");

                return (
                  <div key={review.id} className="flex gap-4 bg-[#1f1f1f] p-3 rounded-lg border border-zinc-800">
                    <Link href={`/movie/${review.movieId}?type=${review.mediaType}`} className="flex-shrink-0 w-16">
                      {movieDetails?.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w200${movieDetails.poster_path}`}
                          alt={title}
                          className="w-full rounded object-cover aspect-[2/3] hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] rounded bg-zinc-800 flex items-center justify-center text-zinc-500 text-[10px] text-center p-1">
                          {tCommon("noPoster")}
                        </div>
                      )}
                    </Link>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/movie/${review.movieId}?type=${review.mediaType}`}
                          className="font-semibold text-zinc-200 hover:text-yellow-500 transition-colors"
                        >
                          {title}
                        </Link>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isLiked && (
                            <svg className="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                          )}
                          {rating !== null && (
                            <span className="bg-zinc-900 px-2 py-0.5 rounded text-yellow-500 font-bold text-xs">
                              ★ {(rating / 2).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {new Date(review.createdAt).toLocaleDateString(tmdbLang)}
                      </p>
                      {review.hasSpoiler ? (
                        <p className="text-yellow-500/80 text-sm mt-2 italic">⚠ {tReviewForm("spoilerWarning")}</p>
                      ) : (
                        review.comment && (
                          <p className="text-zinc-400 text-sm mt-2 line-clamp-2">{review.comment}</p>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Diary + Ratings + Watchlist + Activity (ultima) */}
        <div className="lg:w-72 flex-shrink-0 space-y-8">
          <section>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4">
              <Link href={diaryHref} className="text-sm font-bold uppercase tracking-wide text-zinc-400 hover:text-yellow-500 transition-colors">
                {tDiary("title")}
              </Link>
              <Link href={diaryHref} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
                {tActivity("seeAll")}
              </Link>
            </div>
            <DiaryTable entries={diaryPreview} locale={tmdbLang} variant="compact" />
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400 mb-4 border-b border-zinc-800 pb-2">
              {t("ratingsTitle")}
            </h2>
            <div className="flex items-end gap-1 h-24">
              {ratingHistogram.map((bucket) => (
                <div key={bucket.rating} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-yellow-500 to-amber-400 rounded-t-sm"
                    style={{ height: `${Math.max((bucket.count / maxRatingCount) * 100, bucket.count > 0 ? 8 : 2)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>0.5★</span>
              <span>5★</span>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4">
              <Link href={watchlistHref} className="text-sm font-bold uppercase tracking-wide text-zinc-400 hover:text-yellow-500 transition-colors">
                {t("watchlistTitle")}
              </Link>
              <Link href={watchlistHref} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
                {watchlistCount}
              </Link>
            </div>
            {detailedWatchlistPreview.length === 0 ? (
              <p className="text-zinc-500 text-sm italic">{t("watchlistEmpty")}</p>
            ) : (
              <Link href={watchlistHref} className="flex" title={t("watchlistTitle")}>
                {detailedWatchlistPreview.map(({ item, details }, idx) => {
                  const movieDetails = details as any;
                  const title = movieDetails?.title || movieDetails?.name || t("unknownTitle");
                  return (
                    <div
                      key={`${item.mediaType}-${item.movieId}`}
                      className={`relative block w-1/3 flex-shrink-0 rounded overflow-hidden ring-1 ring-zinc-950 origin-bottom transition-all duration-300 ease-out hover:-translate-y-4 hover:scale-110 hover:z-30 hover:ring-2 hover:ring-yellow-500/70 hover:shadow-2xl hover:shadow-yellow-500/25 ${
                        idx > 0 ? "-ml-[16%]" : ""
                      }`}
                    >
                      {movieDetails?.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w200${movieDetails.poster_path}`}
                          alt={title}
                          className="w-full object-cover aspect-[2/3]"
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] bg-zinc-800 flex items-center justify-center text-zinc-500 text-[10px] text-center p-1">
                          {tCommon("noPoster")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Link>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">{tActivity("title")}</h2>
              <Link href={`/users/${dbUser.username}/activity`} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
                {tActivity("seeAll")}
              </Link>
            </div>
            <ActivityList items={activityFeed} />
          </section>
        </div>
      </div>
    </main>
  );
}
