"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { deleteReview } from "../../actions";
import ConfirmDialog from "../../../components/ConfirmDialog";

export default function DeleteButton({ reviewId }: { reviewId: number }) {
  const t = useTranslations("DeleteButton");
  const tCommon = useTranslations("Common");
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const doDelete = async () => {
    setConfirming(false);
    setError(false);
    try {
      await deleteReview(reviewId);
    } catch (err) {
      setError(true);
      console.error(err);
    }
  };

  return (
    <div className="ml-4 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs bg-red-950/40 text-red-400 border border-red-900/50 px-3 py-1 rounded hover:bg-red-600 hover:text-white transition-colors font-semibold"
      >
        {t("deleteLabel")}
      </button>
      {error && <span className="text-[11px] text-red-400">{t("errorDelete")}</span>}

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