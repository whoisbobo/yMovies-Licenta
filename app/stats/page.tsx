/* eslint-disable @next/next/no-img-element */
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { getDetailedStats, type RatedFilm } from "../../lib/stats";
import { toTmdbLang } from "../../lib/locale";

// Notă 1..10 → "★★★½".
function renderStars(rating10: number): string {
  const s = rating10 / 2;
  const full = Math.floor(s);
  return "★".repeat(full) + (s - full >= 0.5 ? "½" : "");
}

function FilmRow({ films }: { films: RatedFilm[] }) {
  return (
    <div className="flex gap-3">
      {films.map((f) => (
        <Link key={`${f.mediaType}-${f.movieId}`} href={`/movie/${f.movieId}?type=${f.mediaType}`} className="w-16 flex-shrink-0" title={f.title}>
          {f.posterPath ? (
            <img src={`https://image.tmdb.org/t/p/w200${f.posterPath}`} alt={f.title} className="w-full rounded object-cover aspect-[2/3] hover:opacity-80 transition-opacity" />
          ) : (
            <div className="w-full aspect-[2/3] rounded bg-zinc-800" />
          )}
          <div className="text-yellow-500 text-[11px] mt-1 text-center tracking-tight">{renderStars(f.rating)}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function StatsPage() {
  const { userId } = await auth();
  const lang = await getLocale();
  const t = await getTranslations("Stats");

  if (!userId) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  const isPremium = dbUser?.isPremium ?? false;

  if (!isPremium) {
    return (
      <main className="p-8 max-w-2xl mx-auto mt-16 text-center">
        <h2 className="text-2xl font-bold mb-3">{t("title")}</h2>
        <p className="text-zinc-400 mb-8">{t("premiumRequired")}</p>
        <Link
          href="/premium"
          className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-zinc-900 font-bold shadow-md shadow-yellow-500/20 hover:brightness-110 transition-all"
        >
          {t("premiumCta")}
        </Link>
      </main>
    );
  }

  const stats = await getDetailedStats(userId, toTmdbLang(lang));

  if (stats.totalWatched === 0) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-500 italic">{t("noData")}</main>
    );
  }

  const maxGenreCount = Math.max(...stats.genreStats.map((g) => g.count), 1);
  const maxDecadeCount = Math.max(...stats.decadeStats.map((dd) => dd.count), 1);
  const maxRatingCount = Math.max(...stats.ratingHistogram.map((r) => r.count), 1);
  const maxMonthCount = Math.max(...stats.watchedPerMonth.map((m) => m.count), 1);

  // Mesaj „critic" pe baza diferenței față de media TMDB.
  let criticKey: "criticHigher" | "criticLower" | "criticSame" = "criticSame";
  let criticDelta = "0.0";
  if (stats.critic) {
    const delta = stats.critic.yours - stats.critic.tmdb;
    criticDelta = Math.abs(delta).toFixed(1);
    if (delta >= 0.15) criticKey = "criticHigher";
    else if (delta <= -0.15) criticKey = "criticLower";
  }

  const cards = [
    { label: t("statWatched"), value: String(stats.totalWatched) },
    { label: t("statHours"), value: `${stats.totalHours}h` },
    { label: t("statAvg"), value: stats.avgStars != null ? `★ ${stats.avgStars.toFixed(1)}` : "—" },
    { label: t("statLiked"), value: String(stats.totalLiked) },
  ];

  const splitTotal = stats.moviesCount + stats.tvCount;
  const moviePct = splitTotal ? Math.round((stats.moviesCount / splitTotal) * 100) : 0;
  const maxGenreRating = 5;
  const showBottom = stats.totalRated > 5;

  return (
    <main className="p-8 max-w-5xl mx-auto flex-1 w-full">
      <h2 className="text-2xl font-semibold mb-2 border-l-4 border-yellow-500 pl-3">{t("title")}</h2>
      <p className="text-zinc-500 mb-8 pl-4">{t("subtitle", { count: stats.totalWatched })}</p>

      {/* Headline cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#1f1f1f] border border-zinc-800 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-yellow-500">{c.value}</div>
            <div className="text-xs uppercase tracking-wide text-zinc-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Distribuția notelor */}
        <section>
          <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("ratingDistTitle")}</h3>
          <div className="flex items-end gap-1.5 h-40 border-b border-white/10 pb-1">
            {stats.ratingHistogram.map((b) => (
              <div key={b.rating} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[10px] text-zinc-500">{b.count > 0 ? b.count : ""}</span>
                <div
                  className="w-full bg-gradient-to-t from-yellow-500 to-amber-400 rounded-t-sm"
                  style={{ height: `${Math.max((b.count / maxRatingCount) * 100, b.count > 0 ? 6 : 1)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
            <span>½★</span>
            <span>★★★★★</span>
          </div>
        </section>

        {/* Vizionări pe lună */}
        <section>
          <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("perMonthTitle")}</h3>
          <div className="flex items-end gap-1.5 h-40 border-b border-white/10 pb-1">
            {stats.watchedPerMonth.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[10px] text-zinc-500">{m.count > 0 ? m.count : ""}</span>
                <div
                  className="w-full bg-gradient-to-t from-yellow-500 to-amber-400 rounded-t-sm"
                  style={{ height: `${Math.max((m.count / maxMonthCount) * 100, m.count > 0 ? 6 : 1)}%` }}
                />
                <span className="text-[9px] text-zinc-600">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Tu vs media TMDB */}
        {stats.critic && (
          <section className="md:col-span-2">
            <h3 className="text-lg font-bold text-zinc-200 mb-1">{t("criticTitle")}</h3>
            <p className="text-zinc-400 text-sm mb-5">{t(criticKey, { delta: criticDelta })}</p>
            <div className="space-y-4 max-w-lg">
              <div className="flex items-center gap-3">
                <span className="w-28 text-sm text-zinc-300 flex-shrink-0">{t("criticYou")}</span>
                <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full" style={{ width: `${(stats.critic.yours / 5) * 100}%` }} />
                </div>
                <span className="w-12 text-sm text-yellow-500 font-bold text-right flex-shrink-0">★ {stats.critic.yours.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-28 text-sm text-zinc-300 flex-shrink-0">{t("criticCrowd")}</span>
                <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${(stats.critic.tmdb / 5) * 100}%` }} />
                </div>
                <span className="w-12 text-sm text-zinc-400 font-bold text-right flex-shrink-0">★ {stats.critic.tmdb.toFixed(1)}</span>
              </div>
            </div>
          </section>
        )}

        {/* Genuri preferate */}
        <section>
          <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("genreChartTitle")}</h3>
          <div className="space-y-3">
            {stats.genreStats.map((genre) => (
              <div key={genre.name} className="flex items-center gap-3">
                <span className="w-28 text-sm text-zinc-400 truncate flex-shrink-0">{genre.name}</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full" style={{ width: `${(genre.count / maxGenreCount) * 100}%` }} />
                </div>
                <span className="w-8 text-sm text-zinc-500 text-right flex-shrink-0">{genre.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Filme pe deceniu */}
        <section>
          <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("decadeChartTitle")}</h3>
          <div className="flex items-end gap-3 pt-6">
            {stats.decadeStats.map((dd) => {
              const h = (dd.count / maxDecadeCount) * 100;
              return (
                <div key={dd.decade} className="flex-1 flex flex-col items-center">
                  <div className="relative w-full max-w-[44px] h-36 rounded-lg bg-white/[0.04]">
                    <div
                      className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-yellow-500 to-amber-400 rounded-lg"
                      style={{ height: `${h}%` }}
                    />
                    {dd.count > 0 && (
                      <span
                        className="absolute inset-x-0 text-center text-xs font-semibold text-zinc-300"
                        style={{ bottom: `calc(${h}% + 4px)` }}
                      >
                        {dd.count}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500 mt-2">{dd.decade}s</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Filme vs Seriale (donut) */}
        <section>
          <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("splitTitle")}</h3>
          <div className="flex items-center gap-6">
            <div
              className="relative w-28 h-28 rounded-full"
              style={{ background: `conic-gradient(#eab308 0 ${moviePct}%, #52525b ${moviePct}% 100%)` }}
            >
              <div className="absolute inset-[14px] rounded-full bg-[#0a0a0a] flex items-center justify-center text-sm font-bold text-zinc-300">
                {splitTotal}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-yellow-500" />
                <span className="text-zinc-300">{t("splitMovies")}</span>
                <span className="text-zinc-500 font-semibold">{stats.moviesCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-zinc-500" />
                <span className="text-zinc-300">{t("splitTv")}</span>
                <span className="text-zinc-500 font-semibold">{stats.tvCount}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Nota medie pe gen */}
        <section>
          <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("genreRatingTitle")}</h3>
          <div className="space-y-3">
            {stats.genreRatings.map((g) => (
              <div key={g.name} className="flex items-center gap-3">
                <span className="w-28 text-sm text-zinc-400 truncate flex-shrink-0">{g.name}</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full" style={{ width: `${(g.avg / maxGenreRating) * 100}%` }} />
                </div>
                <span className="w-12 text-sm text-yellow-500 font-bold text-right flex-shrink-0">★ {g.avg.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top / flop notate */}
        {stats.topRated.length > 0 && (
          <section className="md:col-span-2">
            <div className="grid sm:grid-cols-2 gap-10">
              <div>
                <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("topRatedTitle")}</h3>
                <FilmRow films={stats.topRated} />
              </div>
              {showBottom && (
                <div>
                  <h3 className="text-lg font-bold text-zinc-200 mb-5">{t("bottomRatedTitle")}</h3>
                  <FilmRow films={stats.bottomRated} />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
