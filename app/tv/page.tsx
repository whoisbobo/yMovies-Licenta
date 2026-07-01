/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { pageParamSchema } from "../../lib/validation";
import { getWithFallback, fetchTmdbWithFallback, TTL } from "../../lib/tmdbCache";
import { toTmdbLang } from "../../lib/locale";
import Pagination from "../../components/Pagination";
import FilterDropdown from "../watched/FilterDropdown";
import { getDiscoverSort, normalizeDiscoverSort, discoverSortOptions } from "../../lib/discoverSort";

async function getPopularTVShows(sort: string, page: number = 1, lang: string = "ro") {
  const tmdbLang = toTmdbLang(lang);
  const sortSpec = getDiscoverSort(sort);
  const cacheKey = `discover:tv-popular:${sort}:${page}:${tmdbLang}`;

  // discover/tv + vote_count.gte, nu /tv/popular — la fel ca la filme, evităm
  // seriale obscure cu foarte puține voturi care apar temporar "populare".
  const results = await getWithFallback(cacheKey, async () => {
    const res = await fetchTmdbWithFallback(
      `/discover/tv?api_key=${process.env.TMDB_API_KEY}&sort_by=${sortSpec.tv}&vote_count.gte=200&page=${page}`,
      tmdbLang
    );
    if (!res.ok) throw new Error("TMDB request failed");
    const data = await res.json();
    return data.results || [];
  }, TTL.POPULAR);

  return results || [];
}

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const lang = await getLocale();
  const t = await getTranslations("Tv");
  const tCommon = await getTranslations("Common");
  const tSort = await getTranslations("Watched"); // etichete de sortare reutilizate

  const resolvedSearchParams = await searchParams;
  const currentPage = pageParamSchema.parse(resolvedSearchParams.page);
  const sort = normalizeDiscoverSort(resolvedSearchParams.sort);
  const tvShows = await getPopularTVShows(sort, currentPage, lang);

  const buildPageLink = (page: number) => {
    const params = new URLSearchParams();
    if (sort !== "popular") params.set("sort", sort);
    params.set("page", page.toString());
    return `/tv?${params.toString()}`;
  };

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-semibold border-l-4 border-yellow-500 pl-3">
          {t("popularTv")}
        </h2>
        <FilterDropdown paramKey="sort" anyLabel={tSort("sortPopularity")} options={discoverSortOptions(tSort)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {tvShows.map((show: any) => (
          <Link href={`/movie/${show.id}?type=tv`} key={show.id} className="group cursor-pointer flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 aspect-[2/3]">
              {show.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w500${show.poster_path}`} alt={show.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-sm">
                  {tCommon("noPoster")}
                </div>
              )}
              <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-1 rounded text-xs font-bold shadow">
                ★ {show.vote_average?.toFixed(1) || "0.0"}
              </div>
            </div>
            <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors">
              {show.name}
            </h3>
          </Link>
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        buildPageLink={buildPageLink}
        previousLabel={tCommon("previousPage")}
        nextLabel={tCommon("nextPage")}
        pageLabel={tCommon("page")}
      />
    </main>
  );
}