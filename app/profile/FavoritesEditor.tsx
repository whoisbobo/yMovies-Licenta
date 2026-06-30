"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { setFavoriteSlot, removeFavoriteSlot, reorderFavorites, searchMoviesForFavorite, type FavoriteSearchResult } from "../actions";

export type FavoriteSlot = {
  movieId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
} | null;

interface FavoritesEditorProps {
  initialSlots: FavoriteSlot[];
  limit: number;
}

export default function FavoritesEditor({ initialSlots, limit }: FavoritesEditorProps) {
  const t = useTranslations("Settings");
  const [slots, setSlots] = useState<FavoriteSlot[]>(initialSlots);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoriteSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeSlot === null || query.trim().length === 0) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchMoviesForFavorite(query);
        setResults(found);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeSlot]);

  const openSlot = (index: number) => {
    setActiveSlot(index);
    setQuery("");
    setResults([]);
    setError(null);
  };

  const handlePick = async (index: number, result: FavoriteSearchResult) => {
    setPending(true);
    setError(null);
    try {
      await setFavoriteSlot(index, result.id, result.title, result.mediaType);
      setSlots((prev) => {
        const next = [...prev];
        next[index] = {
          movieId: result.id,
          mediaType: result.mediaType,
          title: result.title,
          posterPath: result.posterPath,
        };
        return next;
      });
      setActiveSlot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setPending(false);
    }
  };

  const handleDrop = async (target: number) => {
    const source = dragIndex;
    setDragIndex(null);
    if (source === null || source === target) return;

    const prev = slots;
    const next = [...slots];
    const [moved] = next.splice(source, 1);
    next.splice(target, 0, moved);
    setSlots(next);

    setPending(true);
    setError(null);
    try {
      await reorderFavorites(
        next.map((s) => (s ? { movieId: s.movieId, mediaType: s.mediaType, title: s.title } : null))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setSlots(prev); // revert la eroare
    } finally {
      setPending(false);
    }
  };

  const handleRemove = async (index: number) => {
    setPending(true);
    setError(null);
    try {
      await removeFavoriteSlot(index);
      setSlots((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 max-w-xl mb-4">
        {Array.from({ length: limit }).map((_, index) => {
          const slot = slots[index];
          return (
            <div
              key={index}
              className={`relative transition-opacity ${dragIndex === index ? "opacity-40" : ""}`}
              draggable={!!slot && !pending}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
            >
              <button
                type="button"
                onClick={() => openSlot(index)}
                disabled={pending}
                className={`w-full aspect-[2/3] rounded-lg overflow-hidden border-2 transition-colors flex items-center justify-center ${
                  slot ? "cursor-move" : ""
                } ${activeSlot === index ? "border-yellow-500" : "border-dashed border-zinc-700 hover:border-zinc-500"}`}
              >
                {slot ? (
                  slot.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w300${slot.posterPath}`}
                      alt={slot.title}
                      draggable={false}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-zinc-500 text-xs text-center p-1">{slot.title}</span>
                  )
                ) : (
                  <span className="text-zinc-600 text-3xl">+</span>
                )}
              </button>
              {slot && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  disabled={pending}
                  title={t("removeLabel")}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {activeSlot !== null && (
        <div className="max-w-xl bg-[#1f1f1f] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-400">{t("searchPromptForSlot", { slot: activeSlot + 1 })}</p>
            <button type="button" onClick={() => setActiveSlot(null)} className="text-zinc-500 hover:text-zinc-300 text-sm">
              {t("closeLabel")}
            </button>
          </div>

          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full bg-[#141414] text-white border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-yellow-500 mb-3"
          />

          {searching && <p className="text-zinc-500 text-sm">{t("searching")}</p>}

          {!searching && query.trim().length > 0 && results.length === 0 && (
            <p className="text-zinc-500 text-sm">{t("noResults")}</p>
          )}

          <div className="space-y-1 max-h-72 overflow-y-auto">
            {results.map((result) => (
              <button
                key={`${result.mediaType}-${result.id}`}
                type="button"
                onClick={() => handlePick(activeSlot, result)}
                disabled={pending}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-white/5 text-left transition-colors disabled:opacity-50"
              >
                {result.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                    alt={result.title}
                    className="w-9 h-14 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-14 bg-zinc-800 rounded flex-shrink-0" />
                )}
                <span className="text-sm text-zinc-200">
                  {result.title} {result.year && <span className="text-zinc-500">({result.year})</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
