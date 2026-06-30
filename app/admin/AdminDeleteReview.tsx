"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminDeleteReview } from "../actions";

export default function AdminDeleteReview({ reviewId }: { reviewId: number }) {
  const t = useTranslations("Admin");
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    setPending(true);
    try {
      await adminDeleteReview(reviewId);
      setDeleted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  };

  if (deleted) return <span className="text-xs text-zinc-600 italic">{t("deleted")}</span>;

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="px-2.5 py-1 rounded text-xs font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
    >
      {t("deleteLabel")}
    </button>
  );
}
