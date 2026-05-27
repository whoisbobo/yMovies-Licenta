"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  
  // Înlocuim componentele problematice cu un hook stabil de client
  const { userId } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1f1f1f] border-b border-zinc-800 px-8 py-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Partea Stângă: Logo & Link-uri */}
        <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-start">
          <Link href="/" className="text-3xl font-extrabold text-yellow-500 tracking-wider hover:opacity-90 transition-opacity">
            yMovies
          </Link>
          <div className="hidden md:flex gap-6 text-zinc-400 font-medium">
            <Link href="/" className="hover:text-white transition-colors">Filme</Link>
            <Link href="/tv" className="hover:text-white transition-colors">Seriale</Link>
            <Link href="/categories" className="hover:text-white transition-colors">Categorii</Link>
          </div>
        </div>

        {/* Partea Centrală: Search Bar */}
        <form onSubmit={handleSearch} className="w-full sm:max-w-md flex-1 mx-0 sm:mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Caută un film..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141414] text-white border border-zinc-700 rounded-full pl-5 pr-12 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors placeholder-zinc-500"
            />
            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-yellow-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Partea Dreaptă: Autentificare în funcție de userId */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
          {!userId ? (
            <div className="flex gap-3">
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-zinc-300 font-semibold text-sm hover:text-white transition-colors">
                  Autentificare
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 py-2 bg-yellow-500 text-zinc-900 font-bold text-sm rounded-full hover:bg-yellow-400 transition-colors">
                  Cont Nou
                </button>
              </SignUpButton>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-zinc-400 text-sm font-medium hidden md:block">Salutare!</span>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10 border-2 border-yellow-500",
                  },
                }}
              />
            </div>
          )}
        </div>

      </div>
    </header>
  );
}