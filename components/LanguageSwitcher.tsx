"use client";

import { useTransition } from "react";
import { changeLanguage } from "../app/actions";

export default function LanguageSwitcher({ currentLang }: { currentLang: string }) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    
    // 1. Setăm cookie-ul instantaneu în browser
    document.cookie = `locale=${newLang}; path=/; max-age=31536000`;

    // 2. Salvăm și pe server, apoi forțăm reîncărcarea paginii
    startTransition(async () => {
      await changeLanguage(newLang);
      window.location.reload(); 
    });
  };

  return (
    <div className="relative inline-flex items-center opacity-90 hover:opacity-100 transition-opacity">
      {/* Iconița Glob Pământesc (Galbenă) */}
      <svg 
        className="w-4 h-4 absolute left-2 text-yellow-500 pointer-events-none" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>

      {/* Meniul de selecție (Galben, FĂRĂ font-bold) */}
      <select
        value={currentLang}
        onChange={handleChange}
        disabled={isPending}
        className="bg-transparent border border-zinc-600 text-yellow-500 rounded px-8 py-1.5 focus:outline-none focus:border-yellow-500 appearance-none cursor-pointer disabled:opacity-50 transition-colors"
      >
        <option value="ro" className="bg-[#141414] text-yellow-500">Română</option>
        <option value="en" className="bg-[#141414] text-yellow-500">English</option>
      </select>

      {/* Săgeata în jos (Galbenă) */}
      <svg 
        className="w-3 h-3 absolute right-2 text-yellow-500 pointer-events-none" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}