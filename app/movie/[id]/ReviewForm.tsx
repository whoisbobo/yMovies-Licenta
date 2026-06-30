"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitReview } from "../../../app/actions";

export default function ReviewForm({ movieId, movieTitle, mediaType }: { movieId: number, movieTitle: string, mediaType: string }) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations("ReviewForm");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    await submitReview(formData);

    setLoading(false);
    (e.target as HTMLFormElement).reset();
    alert(t("alertSuccess"));
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

      <button
        type="submit"
        disabled={loading}
        className="bg-yellow-500 text-zinc-900 px-8 py-2.5 rounded font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50"
      >
        {loading ? t("saving") : t("submitButton")}
      </button>
    </form>
  );
}
