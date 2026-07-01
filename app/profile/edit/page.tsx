/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getCachedMovieDetails } from "../../../lib/tmdbCache";
import { toTmdbLang } from "../../../lib/locale";
import { FAVORITE_LIMIT } from "../../../lib/constants";
import { type FavoriteSlot } from "../FavoritesEditor";
import ProfileEditTabs from "./ProfileEditTabs";

export default async function ProfileEditPage() {
  const { userId } = await auth();
  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);
  const t = await getTranslations("Profile");

  if (!userId) {
    return (
      <main className="p-4 sm:p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  const [dbUser, favorites] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      take: FAVORITE_LIMIT,
    }),
  ]);

  const favoriteSlots: FavoriteSlot[] = Array.from({ length: FAVORITE_LIMIT }, () => null);
  await Promise.all(
    favorites.map(async (fav) => {
      const details = (await getCachedMovieDetails(fav.movieId, fav.mediaType, tmdbLang)) as {
        title?: string;
        name?: string;
        poster_path?: string | null;
      } | null;
      if (fav.position >= 0 && fav.position < FAVORITE_LIMIT) {
        favoriteSlots[fav.position] = {
          movieId: fav.movieId,
          mediaType: fav.mediaType,
          title: details?.title || details?.name || t("unknownTitle"),
          posterPath: details?.poster_path ?? null,
        };
      }
    })
  );

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto flex-1 w-full">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-2xl font-bold text-zinc-100">{t("editProfile")}</h1>
        <Link
          href="/profile"
          className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          {t("doneEditing")}
        </Link>
      </div>

      <ProfileEditTabs
        initialSlots={favoriteSlots}
        limit={FAVORITE_LIMIT}
        initialDisplayName={dbUser?.displayName ?? null}
        initialBio={dbUser?.bio ?? null}
        initialLocation={dbUser?.location ?? null}
        initialWebsite={dbUser?.website ?? null}
        initialGenres={dbUser?.favoriteGenres ?? []}
        username={dbUser?.username ?? ""}
      />
    </main>
  );
}
