"use client";

import { useEffect, useState } from "react";

/**
 * Toast minimalist în colțul din dreapta-jos. Controlat prin `trigger`: de fiecare
 * dată când valoarea se schimbă (ex. un contor incrementat), toast-ul apare ~2.5s.
 */
export default function Toast({ trigger, message }: { trigger: number; message: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger === 0) return; // 0 = stare inițială, nu afișăm nimic
    setShow(true);
    const timer = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900/95 border border-zinc-700/70 shadow-xl shadow-black/50 text-sm text-zinc-100 backdrop-blur transition-all duration-300 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
