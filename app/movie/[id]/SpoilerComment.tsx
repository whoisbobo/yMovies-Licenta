"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function SpoilerComment({ text, isSpoiler }: { text: string; isSpoiler: boolean }) {
  const t = useTranslations("ReviewForm");
  const [revealed, setRevealed] = useState(false);

  if (!isSpoiler || revealed) {
    return <p className="text-zinc-300 leading-relaxed">{text}</p>;
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="w-full text-left rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-500/90 hover:bg-yellow-500/10 transition-colors"
    >
      <span className="font-semibold">⚠ {t("spoilerWarning")}</span>
      <span className="block text-xs text-zinc-500 mt-0.5">{t("spoilerReveal")}</span>
    </button>
  );
}
