/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getCachedMovieDetails } from "../../lib/tmdbCache";
import { toTmdbLang } from "../../lib/locale";
import AdminUserControls from "./AdminUserControls";
import AdminDeleteReview from "./AdminDeleteReview";

const USERS_LIMIT = 100;
const REVIEWS_LIMIT = 20;

export default async function AdminPage() {
  const { userId } = await auth();
  const t = await getTranslations("Admin");

  if (!userId) {
    return <main className="p-8 text-center mt-20 text-xl text-zinc-400">{t("mustLogin")}</main>;
  }

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (me?.role !== "ADMIN") {
    return (
      <main className="p-8 text-center mt-20">
        <h2 className="text-2xl font-bold text-red-400 mb-2">{t("accessDenied")}</h2>
        <p className="text-zinc-500">{t("accessDeniedHint")}</p>
      </main>
    );
  }

  const lang = await getLocale();
  const tmdbLang = toTmdbLang(lang);

  const [
    userCount,
    premiumCount,
    adminCount,
    reviewCount,
    ratingCount,
    watchedCount,
    users,
    recentReviews,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.review.count(),
    prisma.rating.count(),
    prisma.watched.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: USERS_LIMIT,
      select: { id: true, username: true, displayName: true, email: true, role: true, isPremium: true, avatarUrl: true, createdAt: true },
    }),
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: REVIEWS_LIMIT,
      include: { user: { select: { username: true } } },
    }),
  ]);

  const detailedReviews = await Promise.all(
    recentReviews.map(async (review) => {
      const details: any = await getCachedMovieDetails(review.movieId, review.mediaType, tmdbLang);
      return { review, title: details?.title || details?.name || `#${review.movieId}` };
    })
  );

  const cards = [
    { label: t("dashboardUsers"), value: userCount },
    { label: t("dashboardPremium"), value: premiumCount },
    { label: t("dashboardAdmins"), value: adminCount },
    { label: t("dashboardReviews"), value: reviewCount },
    { label: t("dashboardRatings"), value: ratingCount },
    { label: t("dashboardWatched"), value: watchedCount },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto flex-1 w-full">
      <h2 className="text-2xl font-semibold mb-8 border-l-4 border-yellow-500 pl-3">{t("title")}</h2>

      {/* Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#1f1f1f] border border-zinc-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{c.value}</div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Utilizatori */}
      <section className="mb-12">
        <h3 className="text-lg font-bold text-zinc-200 mb-4">{t("usersTitle")} <span className="text-zinc-500 text-sm">({userCount})</span></h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
                <th className="px-4 py-3">{t("colUser")}</th>
                <th className="px-4 py-3">{t("colRole")}</th>
                <th className="px-4 py-3">{t("colPremium")}</th>
                <th className="px-4 py-3">{t("colJoined")}</th>
                <th className="px-4 py-3 text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/60 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/users/${u.username}`} className="flex items-center gap-3 group">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.username} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-zinc-200 truncate group-hover:text-yellow-500 transition-colors">{u.displayName || u.username}</div>
                        <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${u.role === "ADMIN" ? "text-yellow-500" : "text-zinc-400"}`}>
                      {u.role === "ADMIN" ? t("roleAdmin") : t("roleUser")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.isPremium ? "text-yellow-500 font-semibold" : "text-zinc-600"}`}>
                      {u.isPremium ? t("premiumYes") : t("premiumNo")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString(tmdbLang)}
                  </td>
                  <td className="px-4 py-3">
                    <AdminUserControls userId={u.id} role={u.role} isPremium={u.isPremium} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Moderare recenzii */}
      <section>
        <h3 className="text-lg font-bold text-zinc-200 mb-4">{t("reviewsTitle")}</h3>
        {detailedReviews.length === 0 ? (
          <p className="text-zinc-500 text-sm italic">{t("reviewsEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {detailedReviews.map(({ review, title }) => (
              <div key={review.id} className="flex items-start justify-between gap-4 bg-[#1f1f1f] border border-zinc-800 rounded-lg p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/movie/${review.movieId}?type=${review.mediaType}`} className="font-semibold text-zinc-200 hover:text-yellow-500 transition-colors">
                      {title}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {t("by")} @{review.user.username} · {new Date(review.createdAt).toLocaleDateString(tmdbLang)}
                    </span>
                    {review.hasSpoiler && <span className="text-[10px] text-yellow-500/90">⚠</span>}
                  </div>
                  {review.comment && <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{review.comment}</p>}
                </div>
                <AdminDeleteReview reviewId={review.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
