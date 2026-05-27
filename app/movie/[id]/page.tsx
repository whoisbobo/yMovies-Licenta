import { auth } from "@clerk/nextjs/server";
import ReviewForm from "./ReviewForm";
import { prisma } from "../../../lib/prisma";

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

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const movieId = parseInt(resolvedParams.id);
  
  const movie = await getMovieDetails(resolvedParams.id);
  const { userId } = await auth();

  if (!movie) {
    return <div className="text-white text-center mt-20 text-2xl">Filmul nu a putut fi găsit.</div>;
  }

  const reviews = await prisma.review.findMany({
    where: { movieId: movieId },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col md:flex-row gap-12 flex-1 w-full">
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
            {movie.genres?.map((g: { id: number; name: string }) => g.name).join(", ")}
          </span>
        </div>

        <p className="text-lg text-zinc-300 leading-relaxed mb-8">
          {movie.overview || "Acest film nu are încă o descriere în limba română."}
        </p>

        <div className="border-t border-zinc-800 pt-8 mt-auto">
          <h3 className="text-xl font-bold text-yellow-500 mb-2">Zona de Recenzii</h3>
          
          {!userId ? (
            <p className="text-zinc-500 bg-[#1f1f1f] p-4 rounded-lg border border-zinc-800 mb-8">
              Trebuie să te autentifici folosind butonul de sus pentru a lăsa o recenzie.
            </p>
          ) : (
            <div className="mb-12">
              <ReviewForm movieId={movie.id} movieTitle={movie.title} />
            </div>
          )}

          <div className="space-y-6">
            <h4 className="text-lg font-bold text-zinc-300 border-b border-zinc-800 pb-2">
              Păreri de la utilizatori ({reviews.length})
            </h4>
            
            {reviews.length === 0 ? (
              <p className="text-zinc-500 italic">Nu există nicio recenzie pentru acest film. Fii primul care adaugă una!</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-[#1f1f1f] p-5 rounded-lg border border-zinc-800 shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    
                    <div className="flex items-center gap-3">
                      {review.user.avatarUrl ? (
                        <img 
                          src={review.user.avatarUrl} 
                          alt={review.user.username} 
                          className="w-10 h-10 rounded-full border border-zinc-700 object-cover" 
                        />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-yellow-500 font-bold border border-zinc-700">
                          {review.user.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-zinc-200">{review.user.username}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(review.createdAt).toLocaleDateString("ro-RO")}
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 px-3 py-1 rounded text-yellow-500 font-bold border border-zinc-800">
                      ★ {(review.rating / 2).toFixed(1)}
                    </div>
                  </div>
                  
                  <p className="text-zinc-300 leading-relaxed">{review.comment}</p>
                </div>
              ))
            )}
          </div>
          
        </div>
      </div>
    </main>
  );
}