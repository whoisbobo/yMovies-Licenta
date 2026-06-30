"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setUserRole, setUserPremium } from "../actions";

export default function AdminUserControls({
  userId,
  role,
  isPremium,
}: {
  userId: string;
  role: "USER" | "ADMIN";
  isPremium: boolean;
}) {
  const t = useTranslations("Admin");
  const [r, setR] = useState(role);
  const [p, setP] = useState(isPremium);
  const [pending, setPending] = useState(false);

  const toggleRole = async () => {
    const next = r === "ADMIN" ? "USER" : "ADMIN";
    setPending(true);
    try {
      await setUserRole(userId, next);
      setR(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  };

  const togglePremium = async () => {
    setPending(true);
    try {
      await setUserPremium(userId, !p);
      setP(!p);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 justify-end">
      <button
        type="button"
        onClick={toggleRole}
        disabled={pending}
        className="px-2.5 py-1 rounded text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-white/5 disabled:opacity-50 transition-colors"
      >
        {r === "ADMIN" ? t("removeAdmin") : t("makeAdmin")}
      </button>
      <button
        type="button"
        onClick={togglePremium}
        disabled={pending}
        className={`px-2.5 py-1 rounded text-xs font-medium border disabled:opacity-50 transition-colors ${
          p ? "border-zinc-700 text-zinc-300 hover:bg-white/5" : "border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10"
        }`}
      >
        {p ? t("revokePremium") : t("grantPremium")}
      </button>
    </div>
  );
}
