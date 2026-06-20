"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { changeLanguage } from "../app/actions";

const LANGUAGES = [
  { code: "ro", label: "Română" },
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
];

export default function LanguageSwitcher() {
  const currentLang = useLocale();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((lang) => lang.code === currentLang) ?? LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    setIsOpen(false);
    if (code === currentLang) return;

    document.cookie = `locale=${code}; path=/; max-age=31536000`;

    startTransition(async () => {
      await changeLanguage(code);
      window.location.reload();
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-zinc-300 text-sm font-medium hover:border-yellow-500/60 hover:text-yellow-400 transition-colors disabled:opacity-50 cursor-pointer"
      >
        <span>{current.code.toUpperCase()}</span>
        <svg
          className={`w-3 h-3 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-lg border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-xl overflow-hidden z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                lang.code === currentLang
                  ? "bg-zinc-800 text-yellow-400 font-semibold"
                  : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
