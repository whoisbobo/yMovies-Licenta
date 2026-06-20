/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import { prisma } from "../../lib/prisma";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { toTmdbLang } from "../../lib/locale";
import { getCachedMovieDetails } from "../../lib/tmdbCache";

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

  const lang = await getLocale();
  const t = await getTranslations("Watchlist");
  const tCommon = await getTranslations("Common");

  if (!userId) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustBeLoggedIn")}
      </main>
    );
  }

  const listItems = await getWatchlistItems(userId);

  const detailedMovies = await Promise.all(
    listItems.map(async (item) => {
      try {
        // 1. Adaptăm limba în funcție de preferința utilizatorului
        const tmdbLang = toTmdbLang(lang);
        
        // 2. Luăm tipul corect (movie sau tv) salvat anterior în Prisma
        const mediaType = item.movie?.mediaType || "movie";

        // 3. Folosim cache-ul permanent (poster_path deja corectat, cu fallback pe en-US)
        const data: any = await getCachedMovieDetails(item.movieId, mediaType, tmdbLang);

        // 4. Dacă filmul nu mai există / e fantomă, ignorăm elementul
        if (!data) return null;

        // 5. Returnăm datele complete, asigurându-ne că forțăm tipul media corect
        return { ...data, media_type: mediaType };
      } catch {
        return null; // Protecție suplimentară în caz că pică rețeaua
      }
    })
  );

  const cleanMovies = detailedMovies.filter((m) => m !== null);

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {t("title", { count: cleanMovies.length })}
      </h2>

      {cleanMovies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">
          {t("empty")}
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
      )}
    </main>
  );
}