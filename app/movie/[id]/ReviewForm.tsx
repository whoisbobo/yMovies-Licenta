"use client";

import { useState } from "react";
import { submitReview } from "../../actions";

export default function ReviewForm({ movieId, movieTitle }: { movieId: number, movieTitle: string }) {
  const [rating, setRating] = useState(0); // Nota de la 1 la 10
  const [hover, setHover] = useState(0);   
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (rating === 0) {
      alert("Te rog să acorzi o notă în stele!");
      return;
    }

    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    await submitReview(formData);
    
    setLoading(false);
    (e.target as HTMLFormElement).reset(); 
    setRating(0); 
    alert("Recenzia a fost salvată cu succes în baza ta de date!");
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#1f1f1f] p-6 rounded-lg mt-4 border border-zinc-800">
      {/* Trimitem ID-ul, titlul și NOTA ascunsă (1-10) către server */}
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="movieTitle" value={movieTitle} />
      <input type="hidden" name="rating" value={rating} />
      
      <div className="mb-6">
        <label className="block text-zinc-400 mb-2 font-medium">Nota ta:</label>
        
        {/* Sistemul interactiv cu jumătăți de stea */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const starValueFull = star * 2;       // Ex: Steaua 3 = nota 6
            const starValueHalf = starValueFull - 1; // Ex: Jumătate de stea 3 = nota 5
            const currentValue = hover || rating;
            
            const isFull = currentValue >= starValueFull;
            const isHalf = currentValue === starValueHalf;

            return (
              <div key={star} className="relative w-10 h-10 cursor-pointer transition-transform hover:scale-110">
                {/* Stratul 1: Jumătatea stângă invizibilă (pentru X.5) */}
                <div
                  className="absolute left-0 top-0 w-1/2 h-full z-10"
                  onClick={() => setRating(starValueHalf)}
                  onMouseEnter={() => setHover(starValueHalf)}
                  onMouseLeave={() => setHover(0)}
                />
                
                {/* Stratul 2: Jumătatea dreaptă invizibilă (pentru X.0) */}
                <div
                  className="absolute right-0 top-0 w-1/2 h-full z-10"
                  onClick={() => setRating(starValueFull)}
                  onMouseEnter={() => setHover(starValueFull)}
                  onMouseLeave={() => setHover(0)}
                />

                {/* Stratul 3: Steaua de fundal (gri/goală) */}
                <svg className="w-10 h-10 text-zinc-700 absolute top-0 left-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>

                {/* Stratul 4: Steaua colorată (plină sau tăiată pe jumătate din CSS) */}
                {(isFull || isHalf) && (
                  <svg
                    className="w-10 h-10 text-yellow-500 absolute top-0 left-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    style={isHalf ? { clipPath: "inset(0 50% 0 0)" } : {}}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Un mic text ajutător care arată nota exactă calculată din 10 */}
        <span className="text-zinc-500 text-sm mt-2 inline-block">
          {rating > 0 ? `Nota: ${rating} / 10` : "Selectează o nota"}
        </span>
      </div>

      <div className="mb-6">
        <label className="block text-zinc-400 mb-2 font-medium">Comentariul tau:</label>
        <textarea 
          name="comment"
          required
          rows={3}
          placeholder="Ce parere ai despre acest film?"
          className="bg-[#141414] text-white border border-zinc-700 rounded px-4 py-3 w-full focus:outline-none focus:border-yellow-500 resize-none transition-colors"
        ></textarea>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="bg-yellow-500 text-zinc-900 px-8 py-2.5 rounded font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50"
      >
        {loading ? "Se salveaza..." : "Trimite Recenzia"}
      </button>
    </form>
  );
}