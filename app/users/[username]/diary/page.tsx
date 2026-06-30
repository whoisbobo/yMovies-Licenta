import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "../../../../lib/prisma";
import { toTmdbLang } from "../../../../lib/locale";
import DiaryTable, { getDiaryEntries } from "../../../diary/DiaryTable";

export default async function UserDiaryPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const lang = await getLocale();
  const t = await getTranslations("Diary");

  const target = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    select: { id: true, username: true, displayName: true },
  });
  if (!target) notFound();

  const tmdbLang = toTmdbLang(lang);
  const entries = await getDiaryEntries(target.id, tmdbLang);
  const name = target.displayName || target.username;

  return (
    <main className="p-8 max-w-3xl mx-auto flex-1 w-full">
      <Link href={`/users/${target.username}`} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
        ← {name}
      </Link>
      <h2 className="text-2xl font-semibold mt-2 mb-6 border-l-4 border-yellow-500 pl-3">
        {t("userTitle", { name })}
      </h2>
      <DiaryTable entries={entries} locale={tmdbLang} />
    </main>
  );
}
