import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getDetailedStats } from "../../../../lib/stats";
import { toTmdbLang } from "../../../../lib/locale";
import StatsView from "../../../stats/StatsView";

export default async function AdminUserStatsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { userId } = await auth();
  const { username } = await params;
  const lang = await getLocale();
  const t = await getTranslations("Admin");
  const tStats = await getTranslations("Stats");

  if (!userId) {
    return <main className="p-4 sm:p-8 text-center mt-20 text-xl text-zinc-400">{t("mustLogin")}</main>;
  }

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (me?.role !== "ADMIN") {
    return (
      <main className="p-4 sm:p-8 text-center mt-20">
        <h2 className="text-2xl font-bold text-red-400 mb-2">{t("accessDenied")}</h2>
        <p className="text-zinc-500">{t("accessDeniedHint")}</p>
      </main>
    );
  }

  const target = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    select: { id: true, username: true, displayName: true },
  });
  if (!target) notFound();

  const name = target.displayName || target.username;
  const stats = await getDetailedStats(target.id, toTmdbLang(lang));

  if (stats.totalWatched === 0) {
    return (
      <main className="p-4 sm:p-8 max-w-5xl mx-auto flex-1 w-full">
        <a href="/admin" className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">← {t("backToPanel")}</a>
        <h2 className="text-2xl font-semibold mt-2 mb-6 border-l-4 border-yellow-500 pl-3">{t("userStatsTitle", { name })}</h2>
        <p className="text-zinc-500 text-lg italic">{tStats("noData")}</p>
      </main>
    );
  }

  return (
    <StatsView
      stats={stats}
      title={t("userStatsTitle", { name })}
      subtitle={tStats("subtitle", { count: stats.totalWatched })}
      backHref="/admin"
      backLabel={t("backToPanel")}
    />
  );
}
