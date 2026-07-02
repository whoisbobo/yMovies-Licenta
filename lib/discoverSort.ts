/* eslint-disable @typescript-eslint/no-explicit-any */

// Sortări pentru paginile de discover (Movies / TV / categorii). Rezultatele vin
// paginate de la TMDB, deci sortarea se face prin parametrul `sort_by` (movie vs tv
// au chei diferite pentru dată), iar la listele mixte (gen: filme + seriale) se
// re-sortează și client-side cu `compare` după îmbinare.
export type DiscoverSortSpec = {
  movie: string;
  tv: string;
  compare: (a: any, b: any) => number;
};

function dateNum(item: any): number | null {
  const d = item.release_date || item.first_air_date || "";
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : t;
}

// Comparator după dată; elementele fără dată merg mereu la final, indiferent de direcție.
function byDate(dir: "new" | "old") {
  return (a: any, b: any) => {
    const da = dateNum(a);
    const db = dateNum(b);
    if (da === null) return db === null ? 0 : 1;
    if (db === null) return -1;
    return dir === "new" ? db - da : da - db;
  };
}

export const DISCOVER_SORTS: Record<string, DiscoverSortSpec> = {
  popular: {
    movie: "popularity.desc",
    tv: "popularity.desc",
    compare: (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
  },
  rating: {
    movie: "vote_average.desc",
    tv: "vote_average.desc",
    compare: (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
  },
  "release-new": {
    movie: "primary_release_date.desc",
    tv: "first_air_date.desc",
    compare: byDate("new"),
  },
  "release-old": {
    movie: "primary_release_date.asc",
    tv: "first_air_date.asc",
    compare: byDate("old"),
  },
};

export const DEFAULT_DISCOVER_SORT = "popular";

export function getDiscoverSort(sort: string | undefined): DiscoverSortSpec {
  return DISCOVER_SORTS[sort ?? ""] ?? DISCOVER_SORTS[DEFAULT_DISCOVER_SORT];
}

// Cheie sigură pentru cache / URL (doar valori cunoscute).
export function normalizeDiscoverSort(sort: string | undefined): string {
  return sort && DISCOVER_SORTS[sort] ? sort : DEFAULT_DISCOVER_SORT;
}

// Opțiunile pentru dropdown (fără „popular", care e default-ul = anyLabel).
export function discoverSortOptions(t: (key: string) => string) {
  return [
    { value: "rating", label: t("sortTmdbHigh") },
    { value: "release-new", label: t("sortReleaseNew") },
    { value: "release-old", label: t("sortReleaseOld") },
  ];
}
