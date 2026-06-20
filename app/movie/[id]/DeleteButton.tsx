"use client";

import { useTranslations } from "next-intl";
import { deleteReview } from "../../actions";

export default function DeleteButton({ reviewId }: { reviewId: number }) {
  const t = useTranslations("DeleteButton");

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    // Acum confirm() rulează pe client în siguranță!
    if (window.confirm(t("confirmDelete"))) {
      try {
        await deleteReview(reviewId);
      } catch (error) {
        alert(t("errorDelete"));
        console.error(error);
      }
    }
  };

  return (
    <form onSubmit={handleDelete} className="ml-4">
      <button
        type="submit"
        className="text-xs bg-red-950/40 text-red-400 border border-red-900/50 px-3 py-1 rounded hover:bg-red-600 hover:text-white transition-colors font-semibold"
      >
        {t("deleteLabel")}
      </button>
    </form>
  );
}