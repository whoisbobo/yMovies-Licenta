import Link from "next/link";
import { auth } from "@clerk/nextjs/server";  
import ReviewForm from "./ReviewForm";  

// Funcția care trage datele rămâne la fel
async function getMovieDetails(id: string) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&language=ro-RO`,
    { cache: 'no-store' }
  );

  if (!res.ok) {
    console.log("Eroare de la TMDB:", res.status);
    return null;
  }
  return res.json();
}

// AICI am actualizat tipul pentru params ca fiind un Promise
export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  
  // AICI extragem id-ul corect folosind await
  const resolvedParams = await params;
  const movie = await getMovieDetails(resolvedParams.id);
  const { userId } = await auth();

  if (!movie) {
    return <div className="text-white text-center mt-20 text-2xl">Filmul nu a putut fi găsit sau există o problemă de conexiune.</div>;
  }

  return (
    <main className="min-h-screen bg-[#141414] text-white">
      <nav className="p-6">
        <Link href="/" className="text-yellow-500 hover:text-yellow-400 font-semibold">
          &larr; Înapoi la filme
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-4 flex flex-col md:flex-row gap-12">
        <div className="w-full md:w-1/3 flex-shrink-0">
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="w-full rounded-xl shadow-2xl shadow-yellow-500/10 border border-zinc-800"
          />
        </div>

        <div className="w-full md:w-2/3 flex flex-col justify-center">
          <h1 className="text-5xl font-extrabold mb-4">{movie.title}</h1>
          
          <div className="flex gap-4 items-center mb-6 text-zinc-400 font-medium">
            <span className="bg-yellow-500 text-zinc-900 px-3 py-1 rounded font-bold">
              ★ {movie.vote_average?.toFixed(1)}
            </span>
            <span>{movie.release_date?.substring(0, 4)}</span>
            <span>•</span>
            <span className="flex gap-2">
              {movie.genres?.map((g: any) => g.name).join(", ")}
            </span>
          </div>

          <p className="text-lg text-zinc-300 leading-relaxed mb-8">
            {movie.overview || "Acest film nu are încă o descriere în limba română."}
          </p>

          <div className="border-t border-zinc-800 pt-8 mt-auto">
            <h3 className="text-xl font-bold text-yellow-500 mb-2">Zona de Recenzii</h3>
            
            {!userId ? (
              <p className="text-zinc-500 bg-[#1f1f1f] p-4 rounded-lg border border-zinc-800">
                Trebuie să te <Link href="/" className="text-yellow-500 underline">autentifici pe pagina principală</Link> pentru a lăsa o recenzie.
              </p>
            ) : (
              <ReviewForm movieId={movie.id} movieTitle={movie.title} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}