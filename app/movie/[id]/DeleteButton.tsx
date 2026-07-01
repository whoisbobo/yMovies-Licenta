"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { deleteReview } from "../../actions";

export default function DeleteButton({ reviewId }: { reviewId: number }) {
  const t = useTranslations("DeleteButton");
  const [error, setError] = useState(false);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    // confirm() rulează pe client în siguranță (dialog standard de confirmare).
    if (window.confirm(t("confirmDelete"))) {
      setError(false);
      try {
        await deleteReview(reviewId);
      } catch (err) {
        setError(true);
        console.error(err);
      }
    }
  };

  return (
    <form onSubmit={handleDelete} className="ml-4 flex flex-col items-end gap-1">
      <button
        type="submit"
        className="text-xs bg-red-950/40 text-red-400 border border-red-900/50 px-3 py-1 rounded hover:bg-red-600 hover:text-white transition-colors font-semibold"
      >
        {t("deleteLabel")}
      </button>
      {error && <span className="text-[11px] text-red-400">{t("errorDelete")}</span>}
    </form>
  );
}