"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { adminDeleteReview } from "../actions";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function AdminDeleteReview({ reviewId }: { reviewId: number }) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const doDelete = async () => {
    setConfirming(false);
    setPending(true);
    setError(null);
    try {
      await adminDeleteReview(reviewId);
      setDeleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  };

  if (deleted) return <span className="text-xs text-zinc-600 italic">{t("deleted")}</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="px-2.5 py-1 rounded text-xs font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
      >
        {t("deleteLabel")}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <ConfirmDialog
        open={confirming}
        message={t("confirmDelete")}
        confirmLabel={t("deleteLabel")}
        cancelLabel={tCommon("cancel")}
        onConfirm={doDelete}
        onCancel={() => setConfirming(false)}
        danger
      />
    </div>
  );
}
