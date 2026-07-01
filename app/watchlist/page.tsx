import { auth } from "@clerk/nextjs/server";
import { getTranslations, getLocale } from "next-intl/server";
import { toTmdbLang } from "../../lib/locale";
import WatchlistGrid, { fetchDetailedWatchlist } from "./WatchlistGrid";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ decade?: string; genre?: string; sort?: string; view?: string }>;
}) {
  const { userId } = await auth();
  const lang = await getLocale();
  const t = await getTranslations("Watchlist");

  if (!userId) {
    return (
      <main className="p-4 sm:p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustBeLoggedIn")}
      </main>
    );
  }

  const sp = await searchParams;
  const movies = await fetchDetailedWatchlist(userId, toTmdbLang(lang));

  return (
    <main className="p-4 sm:p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">
        {t("title", { count: movies.length })}
      </h2>

      {movies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">{t("empty")}</div>
      ) : (
        <WatchlistGrid movies={movies} sp={sp} />
      )}
    </main>
  );
}
