/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "../../lib/prisma";
import { getCachedMovieDetails } from "../../lib/tmdbCache";

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

export default async function WatchlistGrid({ movies }: { movies: any[] }) {
  const tCommon = await getTranslations("Common");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {movies.map((movie: any) => {
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
  );
}
