"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Am adăugat "isLoaded" pentru a preveni acel flicker de 1 secundă
  const { isLoaded, userId } = useAuth();

  const t = useTranslations("Nav");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/75 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20 px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">

        {/* Partea Stângă: Logo & Link-uri */}
        <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-start">
          <Link
            href="/"
            className="inline-block text-2xl font-extrabold pr-1 bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent"
          >
            yMovies
          </Link>

          <div className="hidden md:flex gap-1 text-zinc-400 font-medium items-center">
            <Link href="/" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors">{t("movies")}</Link>
            <Link href="/tv" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors">{t("tv")}</Link>
            <Link href="/categories" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-white/5 transition-colors">{t("categories")}</Link>
          </div>
        </div>

        {/* Partea Centrală: Search Bar */}
        <form onSubmit={handleSearch} className="w-full sm:max-w-md flex-1 mx-0 sm:mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 text-white border border-white/10 rounded-full px-6 py-2 placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500/60 focus:bg-white/[0.07] transition-colors"
            />
            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-yellow-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

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
                    label={t("myReviews")}
                    href="/reviews"
                    labelIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    }
                  />
                  <UserButton.Link
                    label={t("recommendations")}
                    href="/recommendations"
                    labelIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    }
                  />
                  <UserButton.Link
                    label={t("premium")}
                    href="/premium"
                    labelIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    }
                  />
                </UserButton.MenuItems>
              </UserButton>

              <LanguageSwitcher />
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
