import { auth } from "@clerk/nextjs/server";
import { getTranslations, getLocale } from "next-intl/server";
import { toTmdbLang } from "../../lib/locale";
import DiaryTable, { getDiaryEntries } from "./DiaryTable";

export default async function DiaryPage() {
  const { userId } = await auth();
  const lang = await getLocale();
  const t = await getTranslations("Diary");

  if (!userId) {
    return (
      <main className="p-4 sm:p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  const tmdbLang = toTmdbLang(lang);
  const entries = await getDiaryEntries(userId, tmdbLang);

  return (
    <main className="p-4 sm:p-8 max-w-3xl mx-auto flex-1 w-full">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">{t("title")}</h2>
      <DiaryTable entries={entries} locale={tmdbLang} />
    </main>
  );
}
