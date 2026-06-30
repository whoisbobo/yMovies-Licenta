"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setRating, removeRating } from "../../../app/actions";

const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

export default function RatingControl({
  movieId,
  movieTitle,
  mediaType,
  initialRating,
}: {
  movieId: number;
  movieTitle: string;
  mediaType: string;
  initialRating: number;
}) {
  const t = useTranslations("ReviewForm");
  const [rating, setRatingState] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [pending, setPending] = useState(false);

  const handleSet = async (value: number) => {
    const prev = rating;
    setRatingState(value);
    setPending(true);
    try {
      await setRating(movieId, mediaType, movieTitle, value);
    } catch {
      setRatingState(prev);
    } finally {
      setPending(false);
    }
  };

  const handleClear = async () => {
    const prev = rating;
    setRatingState(0);
    setPending(true);
    try {
      await removeRating(movieId, mediaType);
    } catch {
      setRatingState(prev);
    } finally {
      setPending(false);
    }
  };

  const currentValue = hover || rating;

  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400 text-sm font-medium">{t("yourRating")}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const full = star * 2;
          const half = full - 1;
          const isFull = currentValue >= full;
          const isHalf = currentValue === half;

          return (
            <div
              key={star}
              className={`relative w-7 h-7 transition-transform ${
                pending ? "pointer-events-none opacity-60" : "cursor-pointer hover:scale-110"
              }`}
            >
              <div
                className="absolute left-0 top-0 w-1/2 h-full z-10"
                onClick={() => handleSet(half)}
                onMouseEnter={() => setHover(half)}
                onMouseLeave={() => setHover(0)}
              />
              <div
                className="absolute right-0 top-0 w-1/2 h-full z-10"
                onClick={() => handleSet(full)}
                onMouseEnter={() => setHover(full)}
                onMouseLeave={() => setHover(0)}
              />

              <svg className="w-7 h-7 text-zinc-700 absolute top-0 left-0" fill="currentColor" viewBox="0 0 20 20">
                <path d={STAR_PATH} />
              </svg>

              {(isFull || isHalf) && (
                <svg
                  className="w-7 h-7 text-yellow-500 absolute top-0 left-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  style={isHalf ? { clipPath: "inset(0 50% 0 0)" } : {}}
                >
                  <path d={STAR_PATH} />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      {rating > 0 && (
        <>
          <span className="text-zinc-500 text-sm">{(rating / 2).toFixed(1)}</span>
          <button
            type="button"
            onClick={handleClear}
            disabled={pending}
            className="text-zinc-500 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
            title={t("clearRating")}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
