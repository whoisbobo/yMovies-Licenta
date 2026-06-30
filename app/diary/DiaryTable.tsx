/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "../../lib/prisma";
import { getCachedMovieDetails } from "../../lib/tmdbCache";

export type DiaryEntry = {
  movieId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  year: string | null;
  watchedAt: Date;
  rating: number | null;
  isLiked: boolean;
  hasReview: boolean;
};

const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

// 5 steluțe SVG (verzi), jumătăți reale via clip-path — lățime fixă, mereu aliniate.
function DiaryStars({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => {
        const full = star * 2;
        const half = full - 1;
        const isFull = rating >= full;
        const isHalf = rating === half;
        return (
          <div key={star} className="relative w-[15px] h-[15px]">
            <svg className="w-[15px] h-[15px] text-zinc-700 absolute inset-0" fill="currentColor" viewBox="0 0 20 20">
              <path d={STAR_PATH} />
            </svg>
            {(isFull || isHalf) && (
              <svg
                className="w-[15px] h-[15px] text-green-500 absolute inset-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                style={isHalf ? { clipPath: "inset(0 50% 0 0)" } : {}}
              >
                <path d={STAR_PATH} />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Jurnal: toate filmele văzute, cronologic, cu notă/like/recenzie hidratate.
export async function getDiaryEntries(userId: string, tmdbLang: string, limit?: number): Promise<DiaryEntry[]> {
  const [watched, ratings, likes, reviews] = await Promise.all([
    prisma.watched.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, ...(limit ? { take: limit } : {}) }),
    prisma.rating.findMany({ where: { userId }, select: { movieId: true, mediaType: true, value: true } }),
    prisma.like.findMany({ where: { userId }, select: { movieId: true, mediaType: true } }),
    prisma.review.findMany({ where: { userId }, select: { movieId: true, mediaType: true } }),
  ]);

  const ratingMap = new Map(ratings.map((r) => [`${r.mediaType}:${r.movieId}`, r.value]));
  const likedSet = new Set(likes.map((l) => `${l.mediaType}:${l.movieId}`));
  const reviewedSet = new Set(reviews.map((r) => `${r.mediaType}:${r.movieId}`));

  return Promise.all(
    watched.map(async (w) => {
      const key = `${w.mediaType}:${w.movieId}`;
      const details = (await getCachedMovieDetails(w.movieId, w.mediaType, tmdbLang)) as any;
      const dateStr: string | undefined = details?.release_date || details?.first_air_date;
      return {
        movieId: w.movieId,
        mediaType: w.mediaType,
        title: details?.title || details?.name || "—",
        posterPath: details?.poster_path ?? null,
        year: dateStr ? dateStr.substring(0, 4) : null,
        watchedAt: w.createdAt,
        rating: ratingMap.get(key) ?? null,
        isLiked: likedSet.has(key),
        hasReview: reviewedSet.has(key),
      };
    })
  );
}

export default async function DiaryTable({
  entries,
  locale,
  variant = "full",
}: {
  entries: DiaryEntry[];
  locale: string;
  variant?: "full" | "compact";
}) {
  const t = await getTranslations("Diary");
  const tCommon = await getTranslations("Common");

  if (entries.length === 0) {
    return <p className="text-zinc-500 text-sm italic">{t("empty")}</p>;
  }

  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });

  let lastMonthKey = "";

  // Variantă compactă pentru sidebar-ul de profil: lună (badge mic) + zi + titlu.
  if (variant === "compact") {
    return (
      <ul className="space-y-2">
        {entries.map((e) => {
          const d = new Date(e.watchedAt);
          const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
          const showMonth = monthKey !== lastMonthKey;
          lastMonthKey = monthKey;
          return (
            <li key={`${e.mediaType}-${e.movieId}-${d.getTime()}`} className="flex items-center gap-2 text-sm leading-snug">
              <span className="w-9 flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-yellow-500/80">
                {showMonth ? monthFmt.format(d) : ""}
              </span>
              <span className="w-5 flex-shrink-0 text-right text-zinc-500">{d.getDate()}</span>
              <Link href={`/movie/${e.movieId}?type=${e.mediaType}`} className="text-zinc-200 font-medium hover:text-yellow-500 transition-colors truncate">
                {e.title}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="border-t border-zinc-800/70">
      {entries.map((e) => {
        const d = new Date(e.watchedAt);
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
        const showMonth = monthKey !== lastMonthKey;
        lastMonthKey = monthKey;

        return (
          <div key={`${e.mediaType}-${e.movieId}-${d.getTime()}`} className="flex items-center gap-4 py-3 border-b border-zinc-800/70 hover:bg-white/[0.02] transition-colors">
            {/* Luna (badge calendaristic, o singură dată per lună) */}
            <div className="w-12 flex-shrink-0 flex justify-center">
              {showMonth && (
                <div className="w-11 rounded-lg overflow-hidden bg-zinc-800/70 border border-white/10 text-center shadow-md shadow-black/30">
                  <div className="bg-yellow-500/15 text-yellow-500/90 text-[10px] font-bold uppercase tracking-wider py-1 leading-none">
                    {monthFmt.format(d)}
                  </div>
                  <div className="text-zinc-400 text-[11px] font-semibold py-1 leading-none">
                    {d.getFullYear()}
                  </div>
                </div>
              )}
            </div>

            {/* Ziua */}
            <div className="w-7 text-center text-lg font-light text-zinc-400 flex-shrink-0">{d.getDate()}</div>

            {/* Poster */}
            <Link href={`/movie/${e.movieId}?type=${e.mediaType}`} className="w-10 flex-shrink-0">
              {e.posterPath ? (
                <img src={`https://image.tmdb.org/t/p/w92${e.posterPath}`} alt={e.title} className="w-full rounded aspect-[2/3] object-cover" />
              ) : (
                <div className="w-full rounded aspect-[2/3] bg-zinc-800 flex items-center justify-center text-zinc-500 text-[8px] text-center p-0.5">
                  {tCommon("noPoster")}
                </div>
              )}
            </Link>

            {/* Titlu + an */}
            <div className="flex-1 min-w-0">
              <Link href={`/movie/${e.movieId}?type=${e.mediaType}`} className="font-semibold text-zinc-100 hover:text-yellow-500 transition-colors">
                {e.title}
              </Link>
              {e.year && <span className="text-zinc-500 text-sm ml-2">{e.year}</span>}
            </div>

            {/* Coloane fixe: notă (stele) / inimă / recenzie — aliniate pe toate rândurile */}
            <div className="flex items-center gap-3 flex-shrink-0 pr-2">
              <div className="w-[83px] flex justify-end">{e.rating !== null && <DiaryStars rating={e.rating} />}</div>
              <div className="w-4 flex justify-center">
                {e.isLiked && (
                  <svg className="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                )}
              </div>
              <div className="w-4 flex justify-center">
                {e.hasReview && (
                  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
