import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  buildPageLink: (page: number) => string;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
};

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

export default function Pagination({
  currentPage,
  buildPageLink,
  previousLabel,
  nextLabel,
  pageLabel,
}: PaginationProps) {
  const isFirstPage = currentPage <= 1;

  return (
    <div className="flex justify-center items-center gap-3 mt-12 mb-8">
      {isFirstPage ? (
        <span
          title={previousLabel}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 text-zinc-700 cursor-not-allowed"
        >
          <ArrowIcon direction="left" />
        </span>
      ) : (
        <Link
          href={buildPageLink(currentPage - 1)}
          title={previousLabel}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-yellow-400 transition-colors"
        >
          <ArrowIcon direction="left" />
        </Link>
      )}

      <span className="min-w-[6rem] text-center px-4 py-2 rounded-full bg-yellow-500 text-zinc-900 font-bold text-sm">
        {pageLabel} {currentPage}
      </span>

      <Link
        href={buildPageLink(currentPage + 1)}
        title={nextLabel}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-yellow-400 transition-colors"
      >
        <ArrowIcon direction="right" />
      </Link>
    </div>
  );
}
