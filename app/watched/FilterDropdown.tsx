"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterOption = { value: string; label: string };

export default function FilterDropdown({
  paramKey,
  anyLabel,
  options,
}: {
  paramKey: string;
  anyLabel: string;
  options: FilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const current = searchParams.get(paramKey);
  const currentLabel = options.find((o) => o.value === current)?.label ?? anyLabel;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const select = (value: string | null) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(paramKey);
    else params.set(paramKey, value);
    params.delete("page"); // orice schimbare de filtru repornește de la prima pagină
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
          current
            ? "text-yellow-500 border-yellow-500/30 bg-yellow-500/10"
            : "text-zinc-300 hover:text-white hover:bg-white/5 border-white/10"
        }`}
      >
        <span>{currentLabel}</span>
        <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 max-h-80 overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl shadow-black/40 p-1 z-50">
          <button
            type="button"
            onClick={() => select(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              !current ? "text-yellow-500" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            {anyLabel}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                current === opt.value ? "text-yellow-500" : "text-zinc-300 hover:bg-white/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
