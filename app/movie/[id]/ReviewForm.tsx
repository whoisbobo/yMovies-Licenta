"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitReview } from "../../../app/actions";

export default function ReviewForm({ movieId, movieTitle, mediaType }: { movieId: number, movieTitle: string, mediaType: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const t = useTranslations("ReviewForm");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    setLoading(true);
    setStatus("idle");

    try {
      await submitReview(new FormData(form));
      form.reset();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#1f1f1f] p-6 rounded-lg mt-4 border border-zinc-800">
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="mediaType" value={mediaType} />
      <input type="hidden" name="movieTitle" value={movieTitle} />

      <div className="mb-4">
        <label className="block text-zinc-400 mb-2 font-medium">{t("yourComment")}</label>
        <textarea
          name="comment"
          required
          rows={3}
          placeholder={t("commentPlaceholder")}
          className="bg-[#141414] text-white border border-zinc-700 rounded px-4 py-3 w-full focus:outline-none focus:border-yellow-500 resize-none transition-colors"
        ></textarea>
      </div>

      <label className="flex items-center gap-2 mb-6 text-sm text-zinc-400 cursor-pointer select-none">
        <input
          type="checkbox"
          name="hasSpoiler"
          className="w-4 h-4 rounded border-zinc-600 bg-[#141414] text-yellow-500 accent-yellow-500"
        />
        {t("spoilerLabel")}
      </label>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-500 text-zinc-900 px-8 py-2.5 rounded font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          {loading ? t("saving") : t("submitButton")}
        </button>

        {status === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {t("alertSuccess")}
          </span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-400">{t("submitError")}</span>
        )}
      </div>
    </form>
  );
}
