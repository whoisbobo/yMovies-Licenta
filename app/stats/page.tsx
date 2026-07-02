import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getDetailedStats } from "../../lib/stats";
import { toTmdbLang } from "../../lib/locale";
import StatsView from "./StatsView";

export default async function StatsPage() {
  const { userId } = await auth();
  const lang = await getLocale();
  const t = await getTranslations("Stats");

  if (!userId) {
    return (
      <main className="p-4 sm:p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  const isPremium = dbUser?.isPremium ?? false;

  if (!isPremium) {
    return (
      <main className="p-4 sm:p-8 max-w-2xl mx-auto mt-16 text-center">
        <h2 className="text-2xl font-bold mb-3">{t("title")}</h2>
        <p className="text-zinc-400 mb-8">{t("premiumRequired")}</p>
        <Link
          href="/premium"
          className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-zinc-900 font-bold shadow-md shadow-yellow-500/20 hover:brightness-110 transition-all"
        >
          {t("premiumCta")}
        </Link>
      </main>
    );
  }

  const stats = await getDetailedStats(userId, toTmdbLang(lang));

  if (stats.totalWatched === 0) {
    return (
      <main className="p-4 sm:p-8 text-center mt-20 text-xl text-zinc-500 italic">{t("noData")}</main>
    );
  }

  return (
    <StatsView
      stats={stats}
      title={t("title")}
      subtitle={t("subtitle", { count: stats.totalWatched })}
    />
  );
}
