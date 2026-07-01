import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "../../../../lib/prisma";
import { toTmdbLang } from "../../../../lib/locale";
import WatchlistGrid, { fetchDetailedWatchlist } from "../../../watchlist/WatchlistGrid";

export default async function UserWatchlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ decade?: string; genre?: string; sort?: string; view?: string }>;
}) {
  const { username } = await params;
  const lang = await getLocale();
  const t = await getTranslations("Watchlist");

  const target = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    select: { id: true, username: true, displayName: true },
  });
  if (!target) notFound();

  const sp = await searchParams;
  const movies = await fetchDetailedWatchlist(target.id, toTmdbLang(lang));
  const name = target.displayName || target.username;

  return (
    <main className="p-8 max-w-7xl mx-auto flex-1 w-full flex flex-col">
      <Link href={`/users/${target.username}`} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
        ← {name}
      </Link>
      <h2 className="text-2xl font-semibold mt-2 mb-6 border-l-4 border-yellow-500 pl-3">
        {t("userTitle", { name, count: movies.length })}
      </h2>

      {movies.length === 0 ? (
        <div className="text-center text-zinc-500 mt-20 text-lg italic">{t("emptyOther")}</div>
      ) : (
        <WatchlistGrid movies={movies} sp={sp} />
      )}
    </main>
  );
}
