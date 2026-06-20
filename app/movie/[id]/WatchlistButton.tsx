"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("WatchlistButton");

  const handleClick = async () => {
    try {
      setLoading(true);
      await toggleWatchlist(movieId, movieTitle, mediaType);
      setInWatchlist(!inWatchlist);
    } catch (error) {
      console.error(t("errorLog"), error);
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
        t("processing")
      ) : inWatchlist ? (
        <>
          <span>{t("inWatchlist")}</span>
        </>
      ) : (
        <>
          <span>{t("addWatchlist")}</span>
        </>
      )}
    </button>
  );
}