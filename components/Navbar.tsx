"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import LanguageSwitcher from "./LanguageSwitcher";
import { dictionary, Locale } from "../lib/dictionary";

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<Locale>("ro"); 
  const router = useRouter();
  
  // Am adăugat "isLoaded" pentru a preveni acel flicker de 1 secundă
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (document.cookie.includes("locale=en")) {
      setLang("en");
    } else {
      setLang("ro");
    }
  }, []);

  const t = dictionary[lang];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1f1f1f] border-b border-zinc-800 px-8 py-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Partea Stângă: Logo & Link-uri */}
        <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-start">
          <Link href="/" className="text-3xl font-extrabold text-yellow-500 tracking-tighter">
            yMovies
          </Link>
          
          <div className="hidden md:flex gap-6 text-zinc-400 font-medium items-center">
            <Link href="/" className="hover:text-white transition-colors">{t.movies}</Link>
            <Link href="/tv" className="hover:text-white transition-colors">{t.tv}</Link>
            <Link href="/categories" className="hover:text-white transition-colors">{t.categories}</Link>
          </div>
        </div>

        {/* Partea Centrală: Search Bar */}
        <form onSubmit={handleSearch} className="w-full sm:max-w-md flex-1 mx-0 sm:mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141414] text-white border border-zinc-700 rounded-full px-6 py-2 focus:outline-none focus:border-yellow-500"
            />
            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-yellow-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Partea Dreaptă: Watchlist, Limbă & Autentificare */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-end min-w-[200px] justify-end">
          {/* Dacă Clerk încă se încarcă, arătăm doar un spațiu gol (invizibil) ca să prevenim saltul vizual */}
          {!isLoaded ? (
             <div className="h-10 w-full"></div>
          ) : !userId ? (
            <div className="flex gap-3 items-center">
              <LanguageSwitcher currentLang={lang} />
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-zinc-300 font-semibold text-sm hover:text-white transition-colors">
                  {t.login}
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 py-2 bg-yellow-500 text-zinc-900 font-bold text-sm rounded hover:bg-yellow-400 transition-colors">
                  {t.register}
                </button>
              </SignUpButton>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              
              <Link 
                href="/watchlist" 
                className="flex items-center gap-1 hover:text-yellow-400 text-yellow-500 transition-colors font-bold"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span className="hidden sm:inline">{t.myList}</span>
              </Link>

              <div className="w-px h-6 bg-zinc-700 hidden sm:block"></div>

              <LanguageSwitcher currentLang={lang} />

              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-sm font-medium hidden md:block">{t.hello}</span>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10 border-2 border-yellow-500",
                    },
                  }}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}