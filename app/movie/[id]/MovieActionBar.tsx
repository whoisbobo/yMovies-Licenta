"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toggleWatchlist, toggleWatched, toggleLike, unwatchWithCascade } from "../../actions";

interface MovieActionBarProps {
  movieId: number;
  movieTitle: string;
  mediaType: string;
  initialInWatchlist: boolean;
  initialIsWatched: boolean;
  initialIsLiked: boolean;
  hasReviewOrRating: boolean;
}

type ActionKey = "watchlist" | "watched" | "liked";

export default function MovieActionBar({
  movieId,
  movieTitle,
  mediaType,
  initialInWatchlist,
  initialIsWatched,
  initialIsLiked,
  hasReviewOrRating,
}: MovieActionBarProps) {
  const t = useTranslations("MovieActions");
  const [state, setState] = useState({
    watchlist: initialInWatchlist,
    watched: initialIsWatched,
    liked: initialIsLiked,
  });
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Re-sincronizăm cu serverul după revalidare (ex. nota/recenzia marchează automat
  // "văzut", iar like-ul scoate din watchlist — butoanele trebuie să reflecte asta).
  useEffect(() => {
    setState({ watchlist: initialInWatchlist, watched: initialIsWatched, liked: initialIsLiked });
  }, [initialInWatchlist, initialIsWatched, initialIsLiked]);

  const ACTIONS: {
    key: ActionKey;
    action: (id: number, title: string, type: string) => Promise<void>;
    activeColor: string;
    icon: (active: boolean) => React.ReactNode;
  }[] = [
    {
      key: "watchlist",
      action: toggleWatchlist,
      activeColor: "text-yellow-400 border-yellow-400 bg-yellow-400/10",
      icon: (active) => (
        <svg className="w-[18px] h-[18px]" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      key: "watched",
      action: toggleWatched,
      activeColor: "text-emerald-400 border-emerald-400 bg-emerald-400/10",
      icon: (active) => (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          {active ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
              <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </svg>
      ),
    },
    {
      key: "liked",
      action: toggleLike,
      activeColor: "text-rose-400 border-rose-400 bg-rose-400/10",
      icon: (active) => (
        <svg className="w-[18px] h-[18px]" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ),
    },
  ];

  const handleClick = async (item: (typeof ACTIONS)[number]) => {
    // De-marcarea „văzut" pe un film cu notă/recenzie cere confirmare (ar șterge și nota/recenzia).
    if (item.key === "watched" && state.watched && hasReviewOrRating) {
      setConfirmOpen(true);
      return;
    }
    try {
      setLoading(item.key);
      setErrorMessage(null);
      await item.action(movieId, movieTitle, mediaType);
      setState((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
    } catch (error) {
      console.error(t("errorLog"), error);
      setErrorMessage(error instanceof Error ? error.message : t("errorLog"));
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmUnwatch = async () => {
    try {
      setLoading("watched");
      setErrorMessage(null);
      await unwatchWithCascade(movieId, mediaType);
      setState((prev) => ({ ...prev, watched: false }));
      setConfirmOpen(false);
    } catch (error) {
      console.error(t("errorLog"), error);
      setErrorMessage(error instanceof Error ? error.message : t("errorLog"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        {ACTIONS.filter((item) => !(item.key === "watchlist" && state.watched)).map((item) => {
          const active = state[item.key];
          return (
            <button
              key={item.key}
              onClick={() => handleClick(item)}
              disabled={loading === item.key}
              title={t(item.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium text-sm border transition-all disabled:opacity-50 ${
                active ? item.activeColor : "text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {item.icon(active)}
              <span className="hidden sm:inline">{t(item.key)}</span>
            </button>
          );
        })}
      </div>
      {errorMessage && <p className="text-red-400 text-sm mt-2">{errorMessage}</p>}

      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">{t("unwatchTitle")}</h3>
            <p className="text-sm text-zinc-400 mb-6">{t("unwatchMessage")}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading === "watched"}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {t("unwatchCancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmUnwatch}
                disabled={loading === "watched"}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-400 transition-colors disabled:opacity-50"
              >
                {t("unwatchConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
