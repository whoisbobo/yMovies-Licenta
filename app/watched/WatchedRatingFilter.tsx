"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

export type RatingFilter =
  | { mode: "any" }
  | { mode: "none" }
  | { mode: "range"; min: number; max: number };

// Stele 1..10 (0.5..5), umplere cumulativă, culoare dată de clasă.
function Stars({ value, colorClass, size = "w-4 h-4" }: { value: number; colorClass: string; size?: string }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => {
        const full = star * 2;
        const half = full - 1;
        const isFull = value >= full;
        const isHalf = value === half;
        return (
          <div key={star} className={`relative ${size}`}>
            <svg className={`${size} text-zinc-700 absolute inset-0`} fill="currentColor" viewBox="0 0 20 20">
              <path d={STAR_PATH} />
            </svg>
            {(isFull || isHalf) && (
              <svg
                className={`${size} ${colorClass} absolute inset-0`}
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
  );
}

export default function WatchedRatingFilter({ current }: { current: RatingFilter }) {
  const t = useTranslations("Watched");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const apply = (param: string | null) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (param === null) params.delete("rating");
    else params.set("rating", param);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  // Nota selectată (din URL) și ce afișăm pe stele (hover are prioritate).
  const selectedValue = current.mode === "range" ? current.max : 0;
  const displayValue = hover || selectedValue;

  const triggerLabel =
    current.mode === "any" ? t("filterAny") : current.mode === "none" ? t("filterNone") : null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-zinc-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
      >
        {current.mode === "range" ? (
          <Stars value={current.max} colorClass="text-yellow-500" />
        ) : (
          <span>{triggerLabel}</span>
        )}
        <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl shadow-black/40 p-1 z-50">
          <button
            type="button"
            onClick={() => apply(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              current.mode === "any" ? "text-yellow-500" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            {t("filterAny")}
          </button>
          <button
            type="button"
            onClick={() => apply("none")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              current.mode === "none" ? "text-yellow-500" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            {t("filterNone")}
          </button>

          <div className="border-t border-white/10 mt-1 pt-3 px-3 pb-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">{t("filterRangeLabel")}</p>
            <div className="flex select-none" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((star) => {
                const full = star * 2;
                const half = full - 1;
                const isFull = displayValue >= full;
                const isHalf = displayValue === half;
                return (
                  <div key={star} className="relative w-7 h-7 cursor-pointer">
                    {/* jumătate stânga (½) / dreapta (steaua întreagă) */}
                    <div
                      className="absolute left-0 top-0 w-1/2 h-full z-10"
                      onMouseEnter={() => setHover(half)}
                      onClick={() => apply(`${half}-${half}`)}
                    />
                    <div
                      className="absolute right-0 top-0 w-1/2 h-full z-10"
                      onMouseEnter={() => setHover(full)}
                      onClick={() => apply(`${full}-${full}`)}
                    />
                    <svg className="w-7 h-7 text-zinc-700 absolute inset-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d={STAR_PATH} />
                    </svg>
                    {(isFull || isHalf) && (
                      <svg
                        className="w-7 h-7 text-green-500 absolute inset-0"
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
          </div>
        </div>
      )}
    </div>
  );
}
