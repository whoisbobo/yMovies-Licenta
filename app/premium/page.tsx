import { auth } from "@clerk/nextjs/server";
import { prisma } from "../../lib/prisma";
import { getTranslations } from "next-intl/server";
import { createCheckoutSession, createBillingPortalSession } from "../actions";

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const { userId } = await auth();
  const t = await getTranslations("Premium");
  const resolvedSearchParams = await searchParams;

  const dbUser = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  return (
    <main className="max-w-2xl mx-auto px-8 py-16 flex-1 w-full flex flex-col items-center text-center">
      {resolvedSearchParams.success && (
        <div className="w-full mb-6 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 px-4 py-3 rounded-lg">
          {t("successMessage")}
        </div>
      )}
      {resolvedSearchParams.canceled && (
        <div className="w-full mb-6 bg-zinc-800/60 border border-zinc-700 text-zinc-300 px-4 py-3 rounded-lg">
          {t("canceledMessage")}
        </div>
      )}

      <h1 className="text-4xl font-extrabold text-yellow-500 mb-2">{t("title")}</h1>
      <p className="text-zinc-400 mb-8">{t("subtitle")}</p>

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-8 w-full shadow-xl shadow-yellow-500/5">
        <p className="text-3xl font-bold text-white mb-6">{t("price")}</p>

        <ul className="text-left space-y-3 mb-8 text-zinc-300">
          <li className="flex gap-2"><span className="text-yellow-500">★</span> {t("feature1")}</li>
          <li className="flex gap-2"><span className="text-yellow-500">★</span> {t("feature2")}</li>
          <li className="flex gap-2"><span className="text-yellow-500">★</span> {t("feature3")}</li>
        </ul>

        {!userId ? (
          <p className="text-zinc-500">{t("mustLogin")}</p>
        ) : dbUser?.isPremium ? (
          <div className="flex flex-col gap-4 items-center">
            <p className="text-emerald-400 font-semibold">{t("alreadyPremium")}</p>
            <form action={createBillingPortalSession}>
              <button
                type="submit"
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-lg font-bold transition-colors"
              >
                {t("ctaManage")}
              </button>
            </form>
          </div>
        ) : (
          <form action={createCheckoutSession}>
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-400 text-zinc-900 px-8 py-3 rounded-lg font-bold transition-colors w-full"
            >
              {t("ctaSubscribe")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
