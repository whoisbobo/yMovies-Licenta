import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { relativeTime, type ActivityItem } from "../../lib/activity";

// Notă 1..10 → "★★★½".
function stars(rating10: number): string {
  const s = rating10 / 2;
  const full = Math.floor(s);
  return "★".repeat(full) + (s - full >= 0.5 ? "½" : "");
}

export default async function ActivityList({
  items,
  variant = "compact",
  username,
}: {
  items: ActivityItem[];
  variant?: "compact" | "full";
  username?: string;
}) {
  const t = await getTranslations("Activity");

  if (items.length === 0) {
    return <p className="text-zinc-500 text-sm italic">{t("empty")}</p>;
  }

  const verb: Record<ActivityItem["type"], string> = {
    rated: t("rated"),
    liked: t("liked"),
    reviewed: t("reviewed"),
    watchlisted: t("watchlisted"),
    followed: t("followed"),
  };

  // Link-ul țintă: film sau profil (la "followed").
  const targetLink = (item: ActivityItem) =>
    item.type === "followed" ? `/users/${item.targetUsername}` : `/movie/${item.movieId}?type=${item.mediaType}`;

  if (variant === "full") {
    return (
      <div className="border-t border-zinc-800/70">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-baseline gap-1.5 px-2 py-3 border-b border-zinc-800/70 even:bg-white/[0.015] hover:bg-white/[0.03] transition-colors"
          >
            {username && <span className="font-semibold text-zinc-200 flex-shrink-0">{username}</span>}
            <span className="text-zinc-500 flex-shrink-0">{verb[item.type]}</span>
            <Link href={targetLink(item)} className="font-semibold text-zinc-100 hover:text-yellow-500 transition-colors truncate">
              {item.title}
            </Link>
            {item.type === "rated" && item.rating !== null && (
              <span className="text-zinc-400 flex-shrink-0">{stars(item.rating)}</span>
            )}
            <span className="ml-auto pl-3 text-zinc-600 text-xs flex-shrink-0">{relativeTime(item.createdAt)}</span>
          </div>
        ))}
        <p className="text-zinc-600 text-sm py-4 px-2">{t("endOfActivity")}</p>
      </div>
    );
  }

  // Variantă compactă (sidebar)
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline gap-1.5 text-sm leading-snug">
          <span className="text-zinc-500 flex-shrink-0">{verb[item.type]}</span>
          <Link href={targetLink(item)} className="text-zinc-200 font-medium hover:text-yellow-500 transition-colors truncate">
            {item.title}
          </Link>
          {item.type === "rated" && item.rating !== null && (
            <span className="text-yellow-500 flex-shrink-0">{stars(item.rating)}</span>
          )}
          <span className="ml-auto pl-2 text-zinc-600 text-xs flex-shrink-0">{relativeTime(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
