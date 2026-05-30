/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import { prisma } from "../../lib/prisma";
import Link from "next/link";
import { cookies } from "next/headers"; // Adăugat pentru detectarea limbii

async function getWatchlistItems(userId: string) {
  const items = await prisma.watchlistItem.findMany({
    where: { userId: userId },
    include: {
      movie: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return items;
}

export default async function WatchlistPage() {
  const { userId } = await auth();

  // Citim cookie-ul de limbă direct pe server
  const cookieStore = await cookies();
  const lang = cookieStore.get("locale")?.value || "ro";

  if (!userId) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-400">
        {lang === "en" 
          ? "You must be logged in to view your watchlist." 
          : "Trebuie să fii autentificat pentru a-ți vedea lista de vizionare."}
      </main>
    );
  }

  const listItems = await getWatchlistItems(userId);

  const detailedMovies = await Promise.all(
    listItems.map(async (item) => {
      try {
        // Convertim limba pentru endpoint-ul TMDB
        const tmdbLang = lang === "en" ? "en-US" : "ro-RO";
        
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${item.movieId}?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          const tvRes = await fetch(
            `https://api.themoviedb.org/3/tv/${item.movieId}?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}`,
            { cache: "no-store" }
          );
          if (tvRes.ok) {
            const tvData = await tvRes.json();
            return { ...tvData, media_type: "tv" };
          }
          return null;
        }
        const movieData = await res.json();
        return { ...movieData, media_type: "movie" };
      } catch {
        return null;
      }
    })
  );

  const cleanMovies = detailedMovies.filter((m) => m !== null);

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {lang === "en" ? `My Watchlist (${cleanMovies.length})` : `Lista Mea de Vizionare (${cleanMovies.length})`}
      </h2>

      {cleanMovies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">
          {lang === "en" ? "You haven't added any movies or TV shows yet." : "Nu ai adăugat încă niciun conținut în lista ta."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {cleanMovies.map((movie: any) => {
            const isTv = movie.media_type === "tv";
            const displayTitle = movie.title || movie.name;
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
                      alt={displayTitle}
                      className="w-full h-full object-cover"
                    />
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
      )}
    </main>
  );
}