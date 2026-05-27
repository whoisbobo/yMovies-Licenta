import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import Link from "next/link";

// Funcția extinsă pentru a suporta atât afișarea filmelor populare, cât și căutarea
async function getMovies(query?: string) {
  const endpoint = query
    ? `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ro-RO`
    : `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}&language=ro-RO`;

  const res = await fetch(endpoint, { cache: 'no-store' });

  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// Next.js 15+ ne cere ca searchParams să fie tratat ca un Promise
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
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

  // Extragem textul din căutare folosind await
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.search;

  const movies = await getMovies(query);

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full">
      {/* Schimbăm titlul dinamic în funcție de starea paginii */}
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {query ? `Rezultatele căutării pentru: "${query}"` : "Filme Populare"}
      </h2>
      
      {movies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">
          Nu am găsit niciun film care să se potrivească cu textul căutat.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {movies.map((movie: any) => (
            <Link href={`/movie/${movie.id}`} key={movie.id} className="group cursor-pointer flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 duration-200 aspect-[2/3] bg-zinc-900 border border-zinc-800">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs p-4 text-center italic">
                    Fără Poster
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-0.5 rounded text-xs font-bold border border-zinc-800">
                  ★ {movie.vote_average?.toFixed(1) || "0.0"}
                </div>
              </div>
              <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors text-sm mt-1">
                {movie.title}
              </h3>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}