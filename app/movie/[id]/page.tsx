/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import ReviewForm from "./ReviewForm";
import { prisma } from "../../../lib/prisma";
import DeleteButton from "./DeleteButton";
import WatchlistButton from "./WatchlistButton";
import { cookies } from "next/headers";

async function getMovieDetails(id: string, type: string, lang: string = "ro") {
  const endpointType = type === "tv" ? "tv" : "movie";
  const tmdbLang = lang === "en" ? "en-US" : "ro-RO";
  const res = await fetch(
    `https://api.themoviedb.org/3/${endpointType}/${id}?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function MoviePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const movieId = parseInt(resolvedParams.id);
  const contentType = resolvedSearchParams.type || "movie";

  // Citim limba din cookie
  const cookieStore = await cookies();
  const lang = cookieStore.get("locale")?.value || "ro";

  const movie = await getMovieDetails(resolvedParams.id, contentType, lang);
  const { userId } = await auth();

  if (!movie) {
    return <div className="text-white text-center mt-20 text-2xl">{lang === "en" ? "Content not found." : "Conținutul nu a putut fi găsit."}</div>;
  }

  const title = movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date;
  const dbUser = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  // AICI AM MODIFICAT: Acum filtrăm recenziile folosind și tipul media!
  const reviews = await prisma.review.findMany({
    where: { 
      movieId: movieId,
      mediaType: contentType 
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  const watchlistItem = userId
    ? await prisma.watchlistItem.findUnique({
      where: {
        userId_movieId_mediaType: { 
          userId: userId as string,
          movieId: movieId,       // <--- AICI E MODIFICAREA: Folosim direct variabila calculată sus!
          mediaType: contentType,     
        },
      },
    })
  : null;
  const inWatchlist = !!watchlistItem;

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col md:flex-row gap-12 flex-1 w-full">
      <div className="w-full md:w-1/3 flex-shrink-0">
        <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={title} className="w-full rounded-xl shadow-2xl shadow-yellow-500/10 border border-zinc-800" />
      </div>

      <div className="w-full md:w-2/3 flex flex-col justify-center">
        <h1 className="text-5xl font-extrabold mb-4">{title}</h1>

        <div className="flex gap-4 items-center mb-6 text-zinc-400 font-medium">
          <span className="bg-yellow-500 text-zinc-900 px-3 py-1 rounded font-bold">★ {movie.vote_average?.toFixed(1) || "0.0"}</span>
          <span>{releaseDate?.substring(0, 4)}</span>
          <span className="flex gap-2">{movie.genres?.map((g: any) => g.name).join(", ")}</span>
        </div>

        <p className="text-lg text-zinc-300 leading-relaxed mb-8">
          {movie.overview || (lang === "en" ? "This content does not have an English description yet." : "Acest conținut nu are încă o descriere în limba română.")}
        </p>

        {userId && (
          <div className="mb-6">
            <WatchlistButton 
            movieId={movie.id} 
            movieTitle={title} 
            initialInWatchlist={inWatchlist}
            mediaType={contentType}
            />
          </div>
        )}

        <div className="border-t border-zinc-800 pt-8 mt-auto">
          <h3 className="text-xl font-bold text-yellow-500 mb-6">{lang === "en" ? "Reviews Section" : "Zona de Recenzii"}</h3>

          {!userId ? (
            <p className="text-zinc-500 bg-[#1f1f1f] p-4 rounded-lg border border-zinc-800 mb-12">
              {lang === "en" ? "You must log in using the button above to leave a review." : "Trebuie să te autentifici folosind butonul de sus pentru a lăsa o recenzie."}
            </p>
          ) : (
            <div className="mb-12">
              {/* AICI AM MODIFICAT: Trimitem și mediaType către formular */}
              <ReviewForm movieId={movie.id} movieTitle={title} mediaType={contentType} />
            </div>
          )}

          <div className="space-y-6">
            <h4 className="text-lg font-bold text-zinc-300 border-b border-zinc-800 pb-2">
              {lang === "en" ? `User Opinions (${reviews.length})` : `Păreri de la utilizatori (${reviews.length})`}
            </h4>

            {reviews.length === 0 ? (
              <p className="text-zinc-500 italic">{lang === "en" ? "There are no reviews. Be the first to leave one!" : "Nu există nicio recenzie. Fii primul care lasă una!"}</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-[#1f1f1f] p-5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {review.user.avatarUrl ? (
                        <img src={review.user.avatarUrl} alt={review.user.username} className="w-10 h-10 rounded-full border border-zinc-700 object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center font-bold text-zinc-500">{review.user.username.substring(0, 2).toUpperCase()}</div>
                      )}
                      <div>
                        <p className="font-semibold text-zinc-200">{review.user.username}</p>
                        <p className="text-xs text-zinc-500">{new Date(review.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "ro-RO")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-900 px-3 py-1 rounded text-yellow-500 font-bold">★ {(review.rating / 2).toFixed(1)}</div>
                      {(dbUser?.role === "ADMIN" || dbUser?.id === review.userId) && <DeleteButton reviewId={review.id} />}
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