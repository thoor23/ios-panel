import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MacPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function MacPagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: MacPaginationProps) {
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border/20 gap-2">
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            'h-7 sm:h-8 px-2 sm:px-3 rounded-lg flex items-center gap-0.5 sm:gap-1 text-xs font-medium transition-all border',
            currentPage === 1
              ? 'opacity-40 cursor-not-allowed border-border/20 text-muted-foreground'
              : 'border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border/60 active:scale-[0.97]'
          )}
        >
          <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>
        {getVisiblePages().map((page, i) =>
          page === '...' ? (
            <span key={`dot-${i}`} className="h-7 sm:h-8 w-4 sm:w-5 flex items-center justify-center text-xs text-muted-foreground">
              ···
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                'h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-xs font-medium transition-all active:scale-[0.97] flex items-center justify-center',
                page === currentPage
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            'h-7 sm:h-8 px-2 sm:px-3 rounded-lg flex items-center gap-0.5 sm:gap-1 text-xs font-medium transition-all border',
            currentPage === totalPages
              ? 'opacity-40 cursor-not-allowed border-border/20 text-muted-foreground'
              : 'border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border/60 active:scale-[0.97]'
          )}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function usePagination<T>(items: T[], itemsPerPage = 10) {
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  return {
    totalPages,
    totalItems: items.length,
    itemsPerPage,
    paginate: (page: number) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage),
  };
}
