import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** 1 2 3 … 26, always keeping the first and last page. */
const pageWindow = (current: number, total: number): (number | "gap")[] => {
  const pages = new Set([1, 2, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
};

export const Pager: React.FC<{
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
}> = ({ page, pageSize, total, noun, onPage }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(total, current * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
      <p className="tabular-nums">
        Showing {first}–{last} of {total} {noun}
      </p>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            onClick={() => onPage(Math.max(1, current - 1))}
            disabled={current <= 1}
            aria-label="Previous page"
            className="btn h-8 w-8 px-0"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pageWindow(current, totalPages).map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} className="px-1.5">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => onPage(n)}
                aria-current={n === current ? "page" : undefined}
                className={`h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium tabular-nums ${
                  n === current ? "bg-accent text-white shadow-card" : "text-ink-2 hover:bg-sunken"
                }`}
              >
                {n}
              </button>
            ),
          )}
          <button
            onClick={() => onPage(Math.min(totalPages, current + 1))}
            disabled={current >= totalPages}
            aria-label="Next page"
            className="btn h-8 w-8 px-0"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
};
