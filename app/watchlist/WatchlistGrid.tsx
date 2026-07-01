/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "../../lib/prisma";
import { getCachedMovieDetails } from "../../lib/tmdbCache";
import FilterDropdown, { type FilterOption } from "../watched/FilterDropdown";
import ViewToggle from "../watched/ViewToggle";

// Aduce watchlist-ul unui user, hidratat cu detalii TMDB (cache).
export async function fetchDetailedWatchlist(userId: string, tmdbLang: string) {
  const items = await prisma.watchlistItem.findMany({
    where: { userId },
    include: { movie: true },
    orderBy: { createdAt: "desc" },
  });

  const detailed = await Promise.all(
    items.map(async (item) => {
      try {
        const mediaType = item.movie?.mediaType || "movie";
        const data: any = await getCachedMovieDetails(item.movieId, mediaType, tmdbLang);
        if (!data) return null;
        return { ...data, media_type: mediaType };
      } catch {
        return null;
      }
    })
  );

  return detailed.filter((m) => m !== null);
}

export type WatchlistSearchParams = { decade?: string; genre?: string; sort?: string; view?: string };

export default async function WatchlistGrid({
  movies,
  sp = {},
}: {
  movies: any[];
  sp?: WatchlistSearchParams;
}) {
  const t = await getTranslations("Watched"); // reutilizăm etichetele generice de filtrare/sortare
  const tCommon = await getTranslations("Common");

  const decadeFilter = sp.decade ?? null;
  const genreFilter = sp.genre ?? null;
  const sort = sp.sort ?? "recent";
  const compact = sp.view === "compact";

  // Câmpuri derivate din detaliile TMDB. Watchlist-ul e deja ordonat "recent" (createdAt desc).
  const detailed = movies.map((movie) => {
    const isTv = movie.media_type === "tv";
    const dateStr: string | undefined = movie.release_date || movie.first_air_date;
    const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : NaN;
    const decade = Number.isNaN(year) ? null : Math.floor(year / 10) * 10;
    const genreNames: string[] = (movie.genres || []).map((g: { name: string }) => g.name);
    const runtime: number | null = movie.runtime ?? movie.episode_run_time?.[0] ?? null;
    return {
      movie,
      isTv,
      title: movie.title || movie.name || "",
      decade,
      genreNames,
      year: Number.isNaN(year) ? null : year,
      voteAverage: typeof movie.vote_average === "number" ? movie.vote_average : null,
      popularity: typeof movie.popularity === "number" ? movie.popularity : null,
      runtime,
    };
  });

  const decadeOptions: FilterOption[] = Array.from(
    new Set(detailed.map((w) => w.decade).filter((d): d is number => d !== null))
  )
    .sort((a, b) => b - a)
    .map((d) => ({ value: String(d), label: `${d}s` }));

  const genreOptions: FilterOption[] = Array.from(new Set(detailed.flatMap((w) => w.genreNames)))
    .sort((a, b) => a.localeCompare(b))
    .map((g) => ({ value: g, label: g }));

  // Filtrare: deceniu + gen. (Fără filtru de notă — filmele din watchlist nu sunt notate.)
  const filtered = detailed.filter(({ decade, genreNames }) => {
    if (decadeFilter && String(decade) !== decadeFilter) return false;
    if (genreFilter && !genreNames.includes(genreFilter)) return false;
    return true;
  });

  type Row = (typeof filtered)[number];
  const comparators: Record<string, (a: Row, b: Row) => number> = {
    name: (a, b) => a.title.localeCompare(b.title),
    "release-new": (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity),
    "release-old": (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity),
    "tmdb-high": (a, b) => (b.voteAverage ?? -1) - (a.voteAverage ?? -1),
    "tmdb-low": (a, b) => (a.voteAverage ?? Infinity) - (b.voteAverage ?? Infinity),
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
    { value: "length-short", label: t("sortLengthShort") },
    { value: "length-long", label: t("sortLengthLong") },
    { value: "popularity", label: t("sortPopularity") },
    { value: "shuffle", label: t("sortShuffle") },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {decadeOptions.length > 0 && (
          <FilterDropdown paramKey="decade" anyLabel={t("filterAnyDecade")} options={decadeOptions} />
        )}
        {genreOptions.length > 0 && (
          <FilterDropdown paramKey="genre" anyLabel={t("filterAnyGenre")} options={genreOptions} />
        )}
        <FilterDropdown paramKey="sort" anyLabel={t("sortRecent")} options={sortOptions} />
        <ViewToggle />
      </div>

      {displayed.length === 0 ? (
        <div className="text-center text-zinc-500 mt-16 text-lg italic">{t("noMatch")}</div>
      ) : (
        <div
          className={
            compact
              ? "grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-x-2 gap-y-3"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
          }
        >
          {displayed.map(({ movie, isTv, title }) => {
            const contentType = isTv ? "tv" : "movie";
            return (
              <Link
                href={`/movie/${movie.id}?type=${contentType}`}
                key={`${contentType}-${movie.id}`}
                className="group cursor-pointer flex flex-col gap-2"
              >
                <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 aspect-[2/3]">
                  {movie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-sm">
                      {tCommon("noPoster")}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-1 rounded text-xs font-bold shadow">
                    ★ {movie.vote_average?.toFixed(1) || "0.0"}
                  </div>
                </div>
                {!compact && (
                  <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors">
                    {title} {isTv && <span className="text-xs text-zinc-500 font-normal">({tCommon("tvShowBadge")})</span>}
                  </h3>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
