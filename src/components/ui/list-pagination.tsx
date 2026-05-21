import { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * usePagination — generic page-slice hook for client-side lists.
 * Resets to page 1 whenever the source array identity or pageSize changes.
 */
export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((items?.length ?? 0) / pageSize));

  // Clamp page if items shrink
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Reset on identity change of items array
  useEffect(() => { setPage(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [items?.length, pageSize]);

  const slice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (items ?? []).slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, totalPages, pageSize, total: items?.length ?? 0, slice };
}

interface ListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  className?: string;
  label?: string;
}

function getPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  if (left > 2) pages.push('ellipsis');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export function ListPagination({ page, totalPages, total, pageSize, onPageChange, className, label = 'items' }: ListPaginationProps) {
  if (total <= pageSize) return null;
  const pages = getPageNumbers(page, totalPages);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'mt-6 flex items-center justify-between gap-4 flex-wrap',
        'border-t border-white/[0.06] pt-5',
        className,
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45 tabular-nums">
        {start}–{end} <span className="opacity-50">of</span> {total} {label}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1.5 text-white/30 font-mono text-[11px]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-[2rem] px-2 inline-flex items-center justify-center rounded-md font-mono text-[11px] tabular-nums transition',
                p === page
                  ? 'bg-white/[0.10] text-white border border-white/15 shadow-[0_0_18px_-8px_hsla(212,100%,55%,0.5)]'
                  : 'border border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
}

export default ListPagination;