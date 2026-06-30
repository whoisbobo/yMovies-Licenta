/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getCachedMovieDetails } from "../../lib/tmdbCache";
import { toTmdbLang } from "../../lib/locale";
import { relativeTime } from "../../lib/activity";
import MarkNotificationsRead from "./MarkNotificationsRead";

const NOTIF_LIMIT = 50;

export default async function NotificationsPage() {
  const { userId } = await auth();
  const t = await getTranslations("Notifications");

  if (!userId) {
    return <main className="p-8 text-center mt-20 text-xl text-zinc-400">{t("mustLogin")}</main>;
  }

  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);

  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: NOTIF_LIMIT,
    include: { actor: { select: { username: true, displayName: true, avatarUrl: true } } },
  });

  const detailed = await Promise.all(
    notifications.map(async (n) => {
      let movieTitle: string | null = null;
      if (n.movieId && n.mediaType) {
        const d: any = await getCachedMovieDetails(n.movieId, n.mediaType, tmdbLang);
        movieTitle = d?.title || d?.name || `#${n.movieId}`;
      }
      return { n, movieTitle };
    })
  );

  const verb = (type: string) =>
    type === "FOLLOW" ? t("verbFollow") : type === "REVIEW_LIKE" ? t("verbLike") : t("verbComment");

  return (
    <main className="p-8 max-w-2xl mx-auto flex-1 w-full">
      <MarkNotificationsRead />
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">{t("title")}</h2>

      {detailed.length === 0 ? (
        <p className="text-zinc-500 text-sm italic">{t("empty")}</p>
      ) : (
        <div className="space-y-1">
          {detailed.map(({ n, movieTitle }) => {
            const name = n.actor.displayName || n.actor.username;
            const href =
              n.type === "FOLLOW"
                ? `/users/${n.actor.username}`
                : n.movieId
                  ? `/movie/${n.movieId}?type=${n.mediaType}`
                  : `/users/${n.actor.username}`;
            return (
              <Link
                key={n.id}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/[0.03] ${
                  n.read ? "" : "bg-yellow-500/[0.06]"
                }`}
              >
                {n.actor.avatarUrl ? (
                  <img src={n.actor.avatarUrl} alt={n.actor.username} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0">
                    {n.actor.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">
                    <span className="font-semibold text-zinc-100">{name}</span> {verb(n.type)}
                    {movieTitle && <span className="font-semibold text-zinc-100"> {movieTitle}</span>}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
