/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import Link from "next/link";
import { cookies } from "next/headers"; // Importăm unalta pentru cookie-uri
import { dictionary, Locale } from "../lib/dictionary";

// Funcția primește acum și limba activă
async function getMovies(query: string | undefined, genreId: string | undefined, page: number = 1, lang: string = "ro") {
  const tmdbLang = lang === "en" ? "en-US" : "ro-RO"; // Convertim pentru TMDB
  
  let endpoint = `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&page=${page}`;

  if (query) {
    endpoint = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&query=${encodeURIComponent(query)}&page=${page}`;
  } else if (genreId) {
    endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&with_genres=${encodeURIComponent(genreId)}&page=${page}`;
  }

  const res = await fetch(endpoint, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();

  if (query) {
    return (data.results || []).filter((item: any) => item.media_type !== 'person');
  }
  return data.results || [];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; genre?: string; name?: string; page?: string }>;
}) {
  const { userId } = await auth();

  if (userId) {
    const user = await currentUser();
    if (user) {
      await prisma.user.upsert({
        where: { id: userId },
        update: {
          email: user.emailAddresses[0].emailAddress,
          username: user.username || `user_${userId.slice(0, 5)}`,
          avatarUrl: user.imageUrl,
        },
        create: {
          id: userId,
          email: user.emailAddresses[0].emailAddress,
          username: user.username || `user_${userId.slice(0, 5)}`,
          avatarUrl: user.imageUrl,
        }
      });
    }
  }

  // Citim cookie-ul de limbă pe server
  const cookieStore = await cookies();
  const lang = (cookieStore.get("locale")?.value || "ro") as Locale;
  const t = dictionary[lang];

  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.search;
  const genreId = resolvedSearchParams.genre;
  const genreName = resolvedSearchParams.name;
  const currentPage = parseInt(resolvedSearchParams.page || "1", 10);

  // Trimitem limba extrasă din cookie către funcția de fetch
  const movies = await getMovies(query, genreId, currentPage, lang);

  let pageTitle = t.popularMovies;
  if (query) {
    pageTitle = lang === "en" ? `Search results for: "${query}"` : `Rezultatele căutării pentru: "${query}"`;
  } else if (genreName) {
    pageTitle = lang === "en" ? `Category: ${genreName}` : `Categoria: ${genreName}`;
  }

  const buildPageLink = (newPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (genreId) params.set("genre", genreId);
    if (genreName) params.set("name", genreName);
    params.set("page", newPage.toString());
    return `/?${params.toString()}`;
  };

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {pageTitle}
      </h2>

      {movies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">
          {lang === "en" ? "No content found on this page." : "Nu am găsit niciun conținut pe această pagină."}
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
                        {lang === "en" ? "No Poster" : "Fără Poster"}
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-1 rounded text-xs font-bold shadow">
                      ★ {movie.vote_average?.toFixed(1) || "0.0"}
                    </div>
                  </div>
                  <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors">
                    {displayTitle} {isTv && <span className="text-xs text-zinc-500 font-normal">({lang === "en" ? "TV Show" : "Serial"})</span>}
                  </h3>
                </Link>
              );
            })}
          </div>

          <div className="flex justify-center items-center gap-6 mt-12 mb-8">
            {currentPage > 1 ? (
              <Link href={buildPageLink(currentPage - 1)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
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

            <Link href={buildPageLink(currentPage + 1)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              {lang === "en" ? "Next Page" : "Pagina Următoare"} &rarr;
            </Link>
          </div>
        </>
      )}
    </main>
  );
}