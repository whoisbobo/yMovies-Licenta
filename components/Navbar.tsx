"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import { searchSuggestions, type FavoriteSearchResult } from "../app/actions";

export default function Navbar({ isAdmin = false, unreadNotifications = 0 }: { isAdmin?: boolean; unreadNotifications?: number }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<FavoriteSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Închide meniul mobil la orice schimbare de pagină (logo, iconițe, panou etc.)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Am adăugat "isLoaded" pentru a preveni acel flicker de 1 secundă
  const { isLoaded, userId } = useAuth();

  const t = useTranslations("Nav");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      router.push(`/movies?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Sugestii live, cu debounce de 300ms
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length === 0) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const found = await searchSuggestions(q);
      setSuggestions(found);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Închide dropdown-ul la click în afara lui
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const goToSuggestion = (s: FavoriteSearchResult) => {
    setShowSuggestions(false);
    setSearchQuery("");
    router.push(`/movie/${s.id}?type=${s.mediaType}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/75 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20 px-6 py-3">
      <div className="max-w-7xl mx-auto">
       <div className="flex flex-col sm:flex-row justify-between items-center gap-4">

        {/* Partea Stângă: Logo & Link-uri */}
        <div className="flex items-center gap-3 md:gap-8 w-full sm:w-auto justify-start">
          {/* Buton hamburger — doar pe mobil */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 rounded-full text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>

          <Link
            href="/"
            className="inline-block text-2xl font-extrabold pr-1 bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent"
          >
            yMovies
          </Link>

          <div className="hidden md:flex gap-1 text-zinc-400 font-medium items-center">
            <Link href="/movies" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors">{t("movies")}</Link>
            <Link href="/tv" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors">{t("tv")}</Link>
            <Link href="/categories" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors">{t("categories")}</Link>
            {userId && (
              <Link href="/users" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors">{t("members")}</Link>
            )}
          </div>
        </div>

        {/* Partea Centrală: Search Bar */}
        <div ref={searchBoxRef} className="w-full sm:max-w-md flex-1 mx-0 sm:mx-8 relative">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-white/5 text-white border border-white/10 rounded-full px-6 py-2 placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500/60 focus:bg-white/[0.07] transition-colors"
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-yellow-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {showSuggestions && searchQuery.trim().length > 0 && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl shadow-black/40 overflow-hidden z-50">
              {suggestions.map((s) => (
                <button
                  key={`${s.mediaType}-${s.id}`}
                  type="button"
                  onClick={() => goToSuggestion(s)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                >
                  {s.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://image.tmdb.org/t/p/w92${s.posterPath}`}
                      alt={s.title}
                      className="w-8 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-12 bg-zinc-800 rounded flex-shrink-0" />
                  )}
                  <span className="text-sm text-zinc-200 truncate">
                    {s.title}
                    {s.year && <span className="text-zinc-500"> ({s.year})</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Partea Dreaptă: Watchlist, Limbă & Autentificare */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end min-w-[200px]">
          {/* Dacă Clerk încă se încarcă, arătăm doar un spațiu gol (invizibil) ca să prevenim saltul vizual */}
          {!isLoaded ? (
             <div className="h-10 w-full"></div>
          ) : !userId ? (
            <div className="flex gap-3 items-center">
              <LanguageSwitcher />
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-zinc-300 font-semibold text-sm hover:text-white transition-colors cursor-pointer">
                  {t("login")}
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-zinc-900 font-bold text-sm rounded-full shadow-md shadow-yellow-500/20 hover:brightness-110 transition-all cursor-pointer">
                  {t("register")}
                </button>
              </SignUpButton>
            </div>
          ) : (
            <div className="flex items-center gap-3">

              <Link
                href="/recommendations"
                title={t("recommendations")}
                className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full text-zinc-300 hover:text-yellow-400 hover:bg-white/5 transition-colors"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </Link>

              <Link
                href="/premium"
                className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-zinc-900 text-xs font-bold shadow-md shadow-yellow-500/20 hover:brightness-110 transition-all"
              >
                {t("premium")}
              </Link>

              <div className="w-px h-6 bg-white/10 hidden sm:block"></div>

              <Link
                href="/watchlist"
                title={t("myList")}
                className="flex items-center gap-1.5 px-1.5 -mr-1.5 h-9 rounded-full text-zinc-300 hover:text-yellow-400 hover:bg-white/5 transition-colors"
              >
                <span className="hidden sm:inline text-sm font-medium">{t("myList")}</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </Link>

              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 border-2 border-yellow-500",
                  },
                }}
              >
                <UserButton.MenuItems>
                  <UserButton.Link
                    label={t("myProfile")}
                    href="/profile"
                    labelIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    }
                  />
                  <UserButton.Link
                    label={t("stats")}
                    href="/stats"
                    labelIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16v-4m5 4V8m5 8v-7" />
                      </svg>
                    }
                  />
                  <UserButton.Link
                    label={t("diary")}
                    href="/diary"
                    labelIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                  <UserButton.Link
                    label={t("myReviews")}
                    href="/reviews"
                    labelIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    }
                  />
                  {isAdmin && (
                    <UserButton.Link
                      label={t("admin")}
                      href="/admin"
                      labelIcon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      }
                    />
                  )}
                </UserButton.MenuItems>
              </UserButton>

              <LanguageSwitcher />

              <Link
                href="/notifications"
                title={t("notifications")}
                className="relative flex items-center justify-center w-9 h-9 rounded-full text-zinc-300 hover:text-yellow-400 hover:bg-white/5 transition-colors"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </Link>
            </div>
          )}
        </div>

       </div>

       {/* Panou de navigare pe mobil */}
       {mobileOpen && (
         <nav className="md:hidden max-w-7xl mx-auto mt-3 pt-3 border-t border-white/10 flex flex-col gap-0.5 text-zinc-300 font-medium">
           <Link href="/movies" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors">{t("movies")}</Link>
           <Link href="/tv" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors">{t("tv")}</Link>
           <Link href="/categories" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors">{t("categories")}</Link>
           {userId && (
             <>
               <Link href="/users" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors">{t("members")}</Link>
               <Link href="/recommendations" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors">{t("recommendations")}</Link>
               <Link href="/premium" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg text-yellow-500 font-semibold hover:bg-white/5 transition-colors">{t("premium")}</Link>
             </>
           )}
         </nav>
       )}
      </div>
    </header>
  );
}
