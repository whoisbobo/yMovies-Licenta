"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "compact" ? "compact" : "grid";

  const setView = (v: "grid" | "compact") => {
    const params = new URLSearchParams(searchParams.toString());
    if (v === "grid") params.delete("view");
    else params.set("view", v);
    const qs = params.toString();
    router.push(qs ? `/watched?${qs}` : "/watched");
  };

  const btn = (active: boolean) =>
    `flex items-center justify-center w-8 h-8 transition-colors ${
      active ? "bg-yellow-500/15 text-yellow-500" : "text-zinc-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <div className="flex items-center border border-white/10 rounded-full overflow-hidden">
      <button type="button" onClick={() => setView("grid")} className={btn(view === "grid")} title="Comfortable">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      </button>
      <button type="button" onClick={() => setView("compact")} className={btn(view === "compact")} title="Compact">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="4.5" height="4.5" rx="1" />
          <rect x="9.75" y="3" width="4.5" height="4.5" rx="1" />
          <rect x="16.5" y="3" width="4.5" height="4.5" rx="1" />
          <rect x="3" y="9.75" width="4.5" height="4.5" rx="1" />
          <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" />
          <rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1" />
          <rect x="3" y="16.5" width="4.5" height="4.5" rx="1" />
          <rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1" />
          <rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1" />
        </svg>
      </button>
    </div>
  );
}
