import Link from "next/link";

async function getGenres() {
  const res = await fetch(
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}&language=ro-RO`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.genres || [];
}

export default async function CategoriesPage() {
  const genres = await getGenres();

  // Stiluri de fundal gradient specifice platformelor media premium
  const gradients = [
    "from-purple-950 to-indigo-900",
    "from-red-950 to-pink-900",
    "from-emerald-950 to-teal-900",
    "from-blue-950 to-cyan-900",
    "from-amber-950 to-orange-900",
    "from-fuchsia-950 to-rose-900"
  ];

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        Răsfoiește după Categorie
      </h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {genres.map((genre: { id: number; name: string }, index: number) => {
          const gradient = gradients[index % gradients.length];
          return (
            <Link
              href={`/?genre=${genre.id}&name=${encodeURIComponent(genre.name)}`}
              key={genre.id}
              className={`bg-gradient-to-br ${gradient} h-28 rounded-xl p-5 flex items-end justify-start font-bold text-base shadow-md border border-zinc-800/50 hover:scale-105 transition-transform duration-200 cursor-pointer group`}
            >
              <span className="group-hover:text-yellow-400 transition-colors tracking-wide">
                {genre.name}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}