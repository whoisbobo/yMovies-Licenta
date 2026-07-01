import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "../../../../lib/prisma";
import { toTmdbLang } from "../../../../lib/locale";
import { getActivityFeed } from "../../../../lib/activity";
import ActivityList from "../../../profile/ActivityList";

const ACTIVITY_PAGE_COUNT = 50;

export default async function UserActivityPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const lang = await getLocale();
  const t = await getTranslations("Activity");

  const target = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    select: { id: true, username: true, displayName: true },
  });
  if (!target) notFound();

  const items = await getActivityFeed(target.id, toTmdbLang(lang), ACTIVITY_PAGE_COUNT);
  const name = target.displayName || target.username;

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto flex-1 w-full">
      <Link href={`/users/${target.username}`} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
        ← {name}
      </Link>
      <h2 className="text-2xl font-semibold mt-2 mb-6 border-l-4 border-yellow-500 pl-3">
        {t("pageTitle", { name })}
      </h2>

      <ActivityList items={items} variant="full" username={name} />
    </main>
  );
}
