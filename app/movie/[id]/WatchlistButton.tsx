"use client";

import { useState, useEffect } from "react";
import { toggleWatchlist } from "../../actions";

interface WatchlistButtonProps {
  movieId: number;
  movieTitle: string;
  initialInWatchlist: boolean;
  mediaType: string;
}

export default function WatchlistButton({ movieId, movieTitle, initialInWatchlist, mediaType }: WatchlistButtonProps) {
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("ro");

  // Citim cookie-ul de limbă pe client
  useEffect(() => {
    if (document.cookie.includes("locale=en")) {
      setLang("en");
    }
  }, []);

  // Dicționar local pentru buton
  const t = {
    ro: {
      processing: "Se procesează...",
      inWatchlist: "✓ În Watchlist",
      addWatchlist: "+ Adaugă în Watchlist",
      errorLog: "Eroare la modificarea watchlist-ului:"
    },
    en: {
      processing: "Processing...",
      inWatchlist: "✓ In Watchlist",
      addWatchlist: "+ Add to Watchlist",
      errorLog: "Error modifying watchlist:"
    }
  };

  const texts = lang === "en" ? t.en : t.ro;

  const handleClick = async () => {
    try {
      setLoading(true);
      await toggleWatchlist(movieId, movieTitle, mediaType);
      setInWatchlist(!inWatchlist);
    } catch (error) {
      console.error(texts.errorLog, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`mt-4 px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border ${
        inWatchlist
          ? "bg-transparent text-yellow-500 border-yellow-500 hover:bg-yellow-500/10"
          : "bg-yellow-500 text-zinc-900 border-transparent hover:bg-yellow-400"
      }`}
    >
      {loading ? (
        texts.processing
      ) : inWatchlist ? (
        <>
          <span>{texts.inWatchlist}</span>
        </>
      ) : (
        <>
          <span>{texts.addWatchlist}</span>
        </>
      )}
    </button>
  );
}