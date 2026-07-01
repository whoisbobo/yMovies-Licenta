/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { homeSearchParamsSchema } from "../../lib/validation";
import { getWithFallback, fetchTmdbWithFallback, TTL } from "../../lib/tmdbCache";
import { toTmdbLang } from "../../lib/locale";
import Pagination from "../../components/Pagination";

// TMDB ține taxonomii de genuri separate pentru filme și seriale (id-uri diferite,
// unele genuri neavând echivalent direct). Maparea de mai jos permite ca o categorie
// din pagina /categories (construită din genurile de filme) să includă și serialele
// din genul TV corespunzător, ca să nu mai fie filtrate complet din rezultate.
const MOVIE_TO_TV_GENRE: Record<string, number> = {
  "28": 10759,   // Action -> Action & Adventure
  "12": 10759,   // Adventure -> Action & Adventure
  "16": 16,      // Animation
  "35": 35,      // Comedy
  "80": 80,      // Crime
  "99": 99,      // Documentary
  "18": 18,      // Drama
  "10751": 10751, // Family
  "14": 10765,   // Fantasy -> Sci-Fi & Fantasy
  "878": 10765,  // Science Fiction -> Sci-Fi & Fantasy
  "9648": 9648,  // Mystery
  "10752": 10768, // War -> War & Politics
  "37": 37,      // Western
};

async function getMovies(query: string | undefined, genreId: string | undefined, page: number = 1, lang: string = "ro") {
  const tmdbLang = toTmdbLang(lang);

  if (query) {
    const cacheKey = `discover:search:${encodeURIComponent(query)}:${page}:${tmdbLang}`;
    const results = await getWithFallback(cacheKey, async () => {
      const res = await fetchTmdbWithFallback(
        `/search/multi?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`,
        tmdbLang
      );
      if (!res.ok) throw new Error("TMDB request failed");
      const data = await res.json();
      return (data.results || []).filter((item: any) => item.media_type !== "person");
    }, TTL.SEARCH);
    return results || [];
  }

  if (genreId) {
    const tvGenreId = MOVIE_TO_TV_GENRE[genreId];
    const cacheKey = `discover:genre:${genreId}:${page}:${tmdbLang}`;
    const results = await getWithFallback(cacheKey, async () => {
      const movieRes = await fetchTmdbWithFallback(
        `/discover/movie?api_key=${process.env.TMDB_API_KEY}&with_genres=${encodeURIComponent(genreId)}&sort_by=popularity.desc&vote_count.gte=200&page=${page}`,
        tmdbLang
      );
      const movieData = movieRes.ok ? await movieRes.json() : { results: [] };
      const movies = (movieData.results || []).map((m: any) => ({ ...m, media_type: "movie" }));

      let shows: any[] = [];
      if (tvGenreId) {
        const tvRes = await fetchTmdbWithFallback(
          `/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_genres=${tvGenreId}&sort_by=popularity.desc&vote_count.gte=200&page=${page}`,
          tmdbLang
        );
        if (tvRes.ok) {
          const tvData = await tvRes.json();
          shows = (tvData.results || []).map((s: any) => ({ ...s, media_type: "tv" }));
        }
      }

      return [...movies, ...shows].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    }, TTL.GENRE);
    return results || [];
  }

  const cacheKey = `discover:popular:${page}:${tmdbLang}`;
  const results = await getWithFallback(cacheKey, async () => {
    const res = await fetchTmdbWithFallback(
      `/discover/movie?api_key=${process.env.TMDB_API_KEY}&sort_by=popularity.desc&vote_count.gte=200&page=${page}`,
      tmdbLang
    );
    if (!res.ok) throw new Error("TMDB request failed");
    const data = await res.json();
    return data.results || [];
  }, TTL.POPULAR);
  return results || [];
}

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; genre?: string; name?: string; page?: string }>;
}) {
  const lang = await getLocale();
  const t = await getTranslations("Home");
  const tCommon = await getTranslations("Common");

  const resolvedSearchParams = await searchParams;
  const parsedParams = homeSearchParamsSchema.parse(resolvedSearchParams);
  const query = parsedParams.search;
  const genreId = parsedParams.genre ? String(parsedParams.genre) : undefined;
  const genreName = parsedParams.name;
  const currentPage = parsedParams.page;

  const movies = await getMovies(query, genreId, currentPage, lang);

  let pageTitle = t("popularMovies");
  if (query) {
    pageTitle = t("searchResultsFor", { query });
  } else if (genreName) {
    pageTitle = t("categoryLabel", { name: genreName });
  }

  const buildPageLink = (newPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (genreId) params.set("genre", genreId);
    if (genreName) params.set("name", genreName);
    params.set("page", newPage.toString());
    return `/movies?${params.toString()}`;
  };

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {pageTitle}
      </h2>

      {movies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">
          {t("noContent")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {movies.map((movie: any) => {
              const isTv = movie.media_type === 'tv';
              const displayTitle = movie.title || movie.name;
              const contentType = isTv ? 'tv' : 'movie';

              return (
                <Link href={`/movie/${movie.id}?type=${contentType}`} key={`${contentType}-${movie.id}`} className="group cursor-pointer flex flex-col gap-2">
                  <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 aspect-[2/3]">
                    {movie.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={displayTitle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-sm">
                        {tCommon("noPoster")}
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-1 rounded text-xs font-bold shadow">
                      ★ {movie.vote_average?.toFixed(1) || "0.0"}
                    </div>
                  </div>
                  <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors">
                    {displayTitle} {isTv && <span className="text-xs text-zinc-500 font-normal">({tCommon("tvShowBadge")})</span>}
                  </h3>
                </Link>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            buildPageLink={buildPageLink}
            previousLabel={tCommon("previousPage")}
            nextLabel={tCommon("nextPage")}
            pageLabel={tCommon("page")}
          />
        </>
      )}
    </main>
  );
}
