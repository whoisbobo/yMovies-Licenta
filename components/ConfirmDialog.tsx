"use client";

import { useEffect } from "react";

/**
 * Modal de confirmare minimalist, în stilul aplicației, ca înlocuitor pentru
 * window.confirm() nativ. Controlat de părinte prin `open` + callback-uri.
 */
export default function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-zinc-700/70 bg-zinc-900 p-5 shadow-2xl shadow-black/50">
        <p className="mb-5 text-sm text-zinc-100">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              danger
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-yellow-500 text-zinc-900 hover:bg-yellow-400"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
