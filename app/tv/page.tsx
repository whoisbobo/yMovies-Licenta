import Link from "next/link";

async function getPopularTVShows() {
  const res = await fetch(
    `https://api.themoviedb.org/3/tv/popular?api_key=${process.env.TMDB_API_KEY}&language=ro-RO`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export default async function TvPage() {
  const tvShows = await getPopularTVShows();

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        Seriale Populare
      </h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {tvShows.map((show: any) => (
          <Link href={`/movie/${show.id}?type=tv`} key={show.id} className="group cursor-pointer flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-lg shadow-md transition-transform group-hover:scale-105 duration-200 aspect-[2/3] bg-zinc-900 border border-zinc-800">
              {show.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
                  alt={show.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs p-4 text-center italic">
                  Fără Poster
                </div>
              )}
              <div className="absolute top-2 right-2 bg-zinc-900/90 text-yellow-500 px-2 py-0.5 rounded text-xs font-bold border border-zinc-800">
                ★ {show.vote_average?.toFixed(1) || "0.0"}
              </div>
            </div>
            <h3 className="font-medium text-zinc-300 line-clamp-1 group-hover:text-yellow-500 transition-colors text-sm mt-1">
              {show.name}
            </h3>
          </Link>
        ))}
      </div>
    </main>
  );
}