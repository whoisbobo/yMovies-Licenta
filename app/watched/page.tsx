/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getCachedMovieDetails } from "../../lib/tmdbCache";
import { toTmdbLang } from "../../lib/locale";
import WatchedRatingFilter, { type RatingFilter } from "./WatchedRatingFilter";
import FilterDropdown, { type FilterOption } from "./FilterDropdown";
import ViewToggle from "./ViewToggle";

function parseRatingFilter(raw: string): RatingFilter {
  if (raw === "none") return { mode: "none" };
  const m = raw.match(/^(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const min = Math.max(1, Math.min(10, parseInt(m[1], 10)));
    const max = Math.max(min, Math.min(10, parseInt(m[2], 10)));
    return { mode: "range", min, max };
  }
  return { mode: "any" };
}

// Notă 1..10 → steluțe stil Letterboxd (★ pline + ½), pe scară de 5.
function renderStars(rating10: number): string {
  const stars = rating10 / 2;
  const full = Math.floor(stars);
  const half = stars - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
}

export default async function WatchedPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string; decade?: string; genre?: string; sort?: string; view?: string }>;
}) {
  const { userId } = await auth();
  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);
  const t = await getTranslations("Watched");
  const tCommon = await getTranslations("Common");

  const sp = await searchParams;
  const ratingFilter = parseRatingFilter(sp.rating ?? "any");
  const decadeFilter = sp.decade ?? null;
  const genreFilter = sp.genre ?? null;
  const sort = sp.sort ?? "recent";
  const compact = sp.view === "compact";

  if (!userId) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  const [watched, ratings, likes] = await Promise.all([
    prisma.watched.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.rating.findMany({ where: { userId }, select: { movieId: true, mediaType: true, value: true } }),
    prisma.like.findMany({ where: { userId }, select: { movieId: true, mediaType: true } }),
  ]);

  const ratingMap = new Map(ratings.map((r) => [`${r.mediaType}:${r.movieId}`, r.value]));
  const likedSet = new Set(likes.map((l) => `${l.mediaType}:${l.movieId}`));

  const detailedWatched = await Promise.all(
    watched.map(async (item) => {
      const details: any = await getCachedMovieDetails(item.movieId, item.mediaType, tmdbLang);
      const key = `${item.mediaType}:${item.movieId}`;
      const dateStr: string | undefined = details?.release_date || details?.first_air_date;
      const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : NaN;
      const decade = Number.isNaN(year) ? null : Math.floor(year / 10) * 10;
      const genreNames: string[] = (details?.genres || []).map((g: { name: string }) => g.name);
      const title: string = details?.title || details?.name || "";
      const runtime: number | null = details?.runtime ?? details?.episode_run_time?.[0] ?? null;
      return {
        item,
        details,
        rating: ratingMap.get(key) ?? null,
        isLiked: likedSet.has(key),
        decade,
        genreNames,
        title,
        year: Number.isNaN(year) ? null : year,
        voteAverage: typeof details?.vote_average === "number" ? details.vote_average : null,
        popularity: typeof details?.popularity === "number" ? details.popularity : null,
        runtime,
      };
    })
  );

  // Opțiuni de filtrare derivate din chiar filmele văzute (fără decade/genuri goale).
  const decadeOptions: FilterOption[] = Array.from(
    new Set(detailedWatched.map((w) => w.decade).filter((d): d is number => d !== null))
  )
    .sort((a, b) => b - a)
    .map((d) => ({ value: String(d), label: `${d}s` }));

  const genreOptions: FilterOption[] = Array.from(new Set(detailedWatched.flatMap((w) => w.genreNames)))
    .sort((a, b) => a.localeCompare(b))
    .map((g) => ({ value: g, label: g }));

  // Filtrare combinată: rating + decade + gen.
  const filtered = detailedWatched.filter(({ rating, decade, genreNames }) => {
    if (ratingFilter.mode === "none" && rating !== null) return false;
    if (ratingFilter.mode === "range" && (rating === null || rating < ratingFilter.min || rating > ratingFilter.max)) return false;
    if (decadeFilter && String(decade) !== decadeFilter) return false;
    if (genreFilter && !genreNames.includes(genreFilter)) return false;
    return true;
  });

  // Comparatori de sortare (null-urile merg la final). "recent" = ordinea de marcare.
  type Row = (typeof filtered)[number];
  const comparators: Record<string, (a: Row, b: Row) => number> = {
    name: (a, b) => a.title.localeCompare(b.title),
    "release-new": (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity),
    "release-old": (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity),
    "tmdb-high": (a, b) => (b.voteAverage ?? -1) - (a.voteAverage ?? -1),
    "tmdb-low": (a, b) => (a.voteAverage ?? Infinity) - (b.voteAverage ?? Infinity),
    "rating-high": (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
    "rating-low": (a, b) => (a.rating ?? Infinity) - (b.rating ?? Infinity),
    "length-short": (a, b) => (a.runtime ?? Infinity) - (b.runtime ?? Infinity),
    "length-long": (a, b) => (b.runtime ?? -1) - (a.runtime ?? -1),
    popularity: (a, b) => (b.popularity ?? -1) - (a.popularity ?? -1),
  };

  const displayed =
    sort === "shuffle"
      ? [...filtered].sort(() => Math.random() - 0.5)
      : comparators[sort]
        ? [...filtered].sort(comparators[sort])
        : filtered;

  const sortOptions: FilterOption[] = [
    { value: "name", label: t("sortName") },
    { value: "release-new", label: t("sortReleaseNew") },
    { value: "release-old", label: t("sortReleaseOld") },
    { value: "tmdb-high", label: t("sortTmdbHigh") },
    { value: "tmdb-low", label: t("sortTmdbLow") },
    { value: "rating-high", label: t("sortYourHigh") },
    { value: "rating-low", label: t("sortYourLow") },
    { value: "length-short", label: t("sortLengthShort") },
    { value: "length-long", label: t("sortLengthLong") },
    { value: "popularity", label: t("sortPopularity") },
    { value: "shuffle", label: t("sortShuffle") },
  ];

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-semibold border-l-4 border-yellow-500 pl-3">
          {t("title")}
        </h2>

        {watched.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <WatchedRatingFilter current={ratingFilter} />
            {decadeOptions.length > 0 && (
              <FilterDropdown paramKey="decade" anyLabel={t("filterAnyDecade")} options={decadeOptions} />
            )}
            {genreOptions.length > 0 && (
              <FilterDropdown paramKey="genre" anyLabel={t("filterAnyGenre")} options={genreOptions} />
            )}
            <FilterDropdown paramKey="sort" anyLabel={t("sortRecent")} options={sortOptions} />
            <ViewToggle />
          </div>
        )}
      </div>

      {watched.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">{t("empty")}</div>
      ) : displayed.length === 0 ? (
        <div className="text-center text-zinc-500 mt-16 text-lg italic">{t("noMatch")}</div>
      ) : (
        <div
          className={
            compact
              ? "grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-x-2 gap-y-3"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-6"
          }
        >
          {displayed.map(({ item, details, rating, isLiked }) => {
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
                  <div className={`flex items-center leading-none ${compact ? "gap-1 mt-1 text-[10px]" : "gap-2 mt-2 text-base"}`}>
                    {rating !== null && (
                      <span className="text-yellow-500 tracking-tight">{renderStars(rating)}</span>
                    )}
                    {isLiked && (
                      <svg className={`text-rose-400 ${compact ? "w-3 h-3" : "w-4 h-4"}`} fill="currentColor" viewBox="0 0 24 24">
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
