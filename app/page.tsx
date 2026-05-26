import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import Link from "next/link"; // Am adăugat importul aici

async function getMovies() {
  const res = await fetch('https://api.themoviedb.org/3/movie/popular?language=en-EN&page=1', {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`
    },
    next: { revalidate: 3600 } 
  });
  
  if (!res.ok) return [];
  const data = await res.json();
  return data.results;
}

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const user = await currentUser();
    if (user) {
      await prisma.user.upsert({
        where: { id: userId },
        update: {
          email: user.emailAddresses[0].emailAddress,
          username: user.username || `user_${userId.slice(0, 5)}`, 
        },
        create: {
          id: userId,
          email: user.emailAddresses[0].emailAddress,
          username: user.username || `user_${userId.slice(0, 5)}`,
        }
      });
    }
  }

  const movies = await getMovies();

  return (
    <main className="min-h-screen bg-[#141414] text-white">
      <nav className="flex justify-between items-center bg-[#1f1f1f] px-8 py-4 shadow-lg border-b border-zinc-800">
        <h1 className="text-3xl font-extrabold text-yellow-500 tracking-wider">
          yMovies
        </h1>

        <div>
          {!userId ? (
            <div className="flex gap-4">
              <SignInButton mode="modal">
                <button className="px-5 py-2 text-zinc-300 font-semibold hover:text-white transition-colors">
                  Autentificare
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-5 py-2 bg-yellow-500 text-zinc-900 font-bold rounded hover:bg-yellow-400 transition-colors">
                  Cont Nou
                </button>
              </SignUpButton>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 font-medium hidden sm:block">Hi!</span>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10 border-2 border-yellow-500"
                  }
                }}
              />
            </div>
          )}
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
          Filme Populare
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {movies.map((movie: any) => (
            <Link href={`/movie/${movie.id}`} key={movie.id} className="group cursor-pointer flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:shadow-yellow-500/20 group-hover:shadow-xl">
                <img 
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} 
                  alt={movie.title}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 font-bold px-2 py-1 rounded text-sm flex items-center gap-1 backdrop-blur-sm">
                  ★ {movie.vote_average.toFixed(1)}
                </div>
              </div>
              <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors">
                {movie.title}
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}