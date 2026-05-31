"use client";

import { useState, useEffect } from "react";
import { submitReview } from "../../../app/actions";

export default function ReviewForm({ movieId, movieTitle, mediaType }: { movieId: number, movieTitle: string, mediaType: string }) {
  const [rating, setRating] = useState(0); 
  const [hover, setHover] = useState(0);   
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("ro");

  // Citim cookie-ul de limbă pe client pentru a ști ce text să afișăm
  useEffect(() => {
    if (document.cookie.includes("locale=en")) {
      setLang("en");
    }
  }, []);

  // Dicționar local pentru acest formular
  const t = {
    ro: {
      alertNoRating: "Te rog să acorzi o notă în stele!",
      alertSuccess: "Recenzia a fost salvată cu succes în baza ta de date!",
      yourRating: "Nota ta:",
      ratingScore: (r: number) => `Nota: ${r} / 10`,
      selectRating: "Selectează o nota",
      yourComment: "Comentariul tau:",
      commentPlaceholder: "Ce parere ai despre acest film?",
      saving: "Se salveaza...",
      submitButton: "Trimite Recenzia"
    },
    en: {
      alertNoRating: "Please provide a star rating!",
      alertSuccess: "The review has been successfully saved to the database!",
      yourRating: "Your rating:",
      ratingScore: (r: number) => `Score: ${r} / 10`,
      selectRating: "Select a rating",
      yourComment: "Your comment:",
      commentPlaceholder: "What are your thoughts on this content?",
      saving: "Saving...",
      submitButton: "Submit Review"
    }
  };

  const texts = lang === "en" ? t.en : t.ro;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (rating === 0) {
      alert(texts.alertNoRating);
      return;
    }

    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    await submitReview(formData);
    
    setLoading(false);
    (e.target as HTMLFormElement).reset(); 
    setRating(0); 
    alert(texts.alertSuccess);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#1f1f1f] p-6 rounded-lg mt-4 border border-zinc-800">
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="mediaType" value={mediaType} />
      <input type="hidden" name="movieTitle" value={movieTitle} />
      <input type="hidden" name="rating" value={rating} />
      
      <div className="mb-6">
        <label className="block text-zinc-400 mb-2 font-medium">{texts.yourRating}</label>
        
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const starValueFull = star * 2;       
            const starValueHalf = starValueFull - 1; 
            const currentValue = hover || rating;
            
            const isFull = currentValue >= starValueFull;
            const isHalf = currentValue === starValueHalf;

            return (
              <div key={star} className="relative w-10 h-10 cursor-pointer transition-transform hover:scale-110">
                <div
                  className="absolute left-0 top-0 w-1/2 h-full z-10"
                  onClick={() => setRating(starValueHalf)}
                  onMouseEnter={() => setHover(starValueHalf)}
                  onMouseLeave={() => setHover(0)}
                />
                
                <div
                  className="absolute right-0 top-0 w-1/2 h-full z-10"
                  onClick={() => setRating(starValueFull)}
                  onMouseEnter={() => setHover(starValueFull)}
                  onMouseLeave={() => setHover(0)}
                />

                <svg className="w-10 h-10 text-zinc-700 absolute top-0 left-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>

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
        
        <span className="text-zinc-500 text-sm mt-2 inline-block">
          {rating > 0 ? texts.ratingScore(rating) : texts.selectRating}
        </span>
      </div>

      <div className="mb-6">
        <label className="block text-zinc-400 mb-2 font-medium">{texts.yourComment}</label>
        <textarea 
          name="comment"
          required
          rows={3}
          placeholder={texts.commentPlaceholder}
          className="bg-[#141414] text-white border border-zinc-700 rounded px-4 py-3 w-full focus:outline-none focus:border-yellow-500 resize-none transition-colors"
        ></textarea>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="bg-yellow-500 text-zinc-900 px-8 py-2.5 rounded font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50"
      >
        {loading ? texts.saving : texts.submitButton}
      </button>
    </form>
  );
}