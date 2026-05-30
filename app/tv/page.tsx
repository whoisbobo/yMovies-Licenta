/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cookies } from "next/headers";
import { dictionary, Locale } from "../../lib/dictionary";

async function getPopularTVShows(page: number = 1, lang: string = "ro") {
  const tmdbLang = lang === "en" ? "en-US" : "ro-RO";
  const res = await fetch(
    `https://api.themoviedb.org/3/tv/popular?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&page=${page}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("locale")?.value || "ro") as Locale;
  const t = dictionary[lang];

  const resolvedSearchParams = await searchParams;
  const currentPage = parseInt(resolvedSearchParams.page || "1", 10);
  const tvShows = await getPopularTVShows(currentPage, lang);

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {t.popularTv}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {tvShows.map((show: any) => (
          <Link href={`/movie/${show.id}?type=tv`} key={show.id} className="group cursor-pointer flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 aspect-[2/3]">
              {show.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w500${show.poster_path}`} alt={show.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-sm">
                  {lang === "en" ? "No Poster" : "Fără Poster"}
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

      <div className="flex justify-center items-center gap-6 mt-12 mb-8">
        {currentPage > 1 ? (
          <Link href={`/tv?page=${currentPage - 1}`} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
            &larr; {lang === "en" ? "Previous Page" : "Pagina Anterioară"}
          </Link>
        ) : (
          <div className="px-6 py-2 rounded-lg font-medium bg-zinc-900 text-zinc-600 cursor-not-allowed">
            &larr; {lang === "en" ? "Previous Page" : "Pagina Anterioară"}
          </div>
        )}
        
        <span className="text-yellow-500 font-bold bg-zinc-900/50 px-4 py-2 rounded-lg border border-yellow-500/20">
          {lang === "en" ? "Page" : "Pagina"} {currentPage}
        </span>

        <Link href={`/tv?page=${currentPage + 1}`} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
          {lang === "en" ? "Next Page" : "Pagina Următoare"} &rarr;
        </Link>
      </div>
    </main>
  );
}