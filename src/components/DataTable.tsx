import { ReactNode, useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MacPagination, usePagination } from '@/components/MacPagination';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (item: T, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  visible?: boolean;
  /** Optional: use on mobile summary row instead of render (e.g. compact/dot-only). */
  renderMobile?: (item: T, index: number) => ReactNode;
  /** If true, this column is always shown as the primary label on mobile */
  primary?: boolean;
  /** If true, hide this column on mobile collapse view */
  hideMobile?: boolean;
  /** If true, column header is clickable to sort. Uses sortKey or key to get value from item. */
  sortable?: boolean;
  /** Key path on item for sorting (defaults to column key). Use for nested e.g. "createdAt" */
  sortKey?: string;
}

/** Max skeleton rows to avoid huge loading state (e.g. itemsPerPage 50) */
const SKELETON_ROWS_MAX = 20;

interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  itemsPerPage?: number;
  page: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
  rowClassName?: (item: T, index: number) => string;
  striped?: boolean;
  className?: string;
  /** When set, pagination is server-side: data is current page only, totalItems is total count */
  totalItems?: number;
  /** Column keys to show in mobile main row (default: first + last). E.g. ['date','type','amount'] */
  mobileSummaryKeys?: string[];
  /** On mobile 3-column summary, align last column 'left' or 'right' (default 'right'). Use 'left' for amount/price. */
  mobileSummaryLastAlign?: 'left' | 'right';
  /** When true, show skeleton rows and keep table height; keeps desktop/mobile layout unchanged */
  loading?: boolean;
  /** Min height when loading or empty so layout doesn't jump (e.g. '260px'). Optional. */
  minHeight?: string;
}



/** Skeleton row for mobile: same structure as MobileRow (min-h-[44px], px-4 py-2.5) so layout doesn't shift */
function MobileSkeletonRow({ summaryColCount, lastAlign = 'right' }: { summaryColCount?: number; lastAlign?: 'left' | 'right' }) {
  const threeCol = summaryColCount === 3;
  const fourCol = summaryColCount === 4;
  return (
    <div className="border-b border-border/15 last:border-0">
      <div className="w-full flex items-center min-h-[44px] px-4 py-2.5">
        {fourCol ? (
          <div className="grid w-full min-w-0 items-center gap-x-2 sm:gap-x-3" style={{ gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, 1fr) minmax(0, auto)' }}>
            <div className="min-w-0 text-left"><div className="h-4 bg-muted/50 rounded animate-pulse w-16" /></div>
            <div className="min-w-0 flex justify-center"><div className="h-4 bg-muted/50 rounded animate-pulse w-2/3 max-w-[70px]" /></div>
            <div className="min-w-0 flex justify-center"><div className="h-4 bg-muted/50 rounded animate-pulse w-2/3 max-w-[60px]" /></div>
            <div className="min-w-0 flex justify-end"><div className="h-4 bg-muted/50 rounded animate-pulse w-12 shrink-0" /></div>
          </div>
        ) : threeCol ? (
          <div className="grid w-full min-w-0 items-center gap-x-2 sm:gap-x-3" style={{ gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)' }}>
            <div className="min-w-0 text-left"><div className="h-4 bg-muted/50 rounded animate-pulse w-20" /></div>
            <div className="min-w-0 flex justify-center"><div className="h-4 bg-muted/50 rounded animate-pulse w-2/3 max-w-[80px]" /></div>
            <div className={cn('min-w-0 flex justify-end', lastAlign === 'left' && 'justify-start')}><div className="h-4 bg-muted/50 rounded animate-pulse w-14 shrink-0" /></div>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full min-w-0">
            <div className="min-w-0 flex-1 text-left"><div className="h-4 bg-muted/50 rounded animate-pulse max-w-[120px]" /></div>
            <div className="shrink-0 flex justify-end"><div className="h-4 bg-muted/50 rounded animate-pulse w-12" /></div>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileRow<T>({ item, index, columns, rowClassName, mobileSummaryKeys, lastAlign = 'right' }: {
  item: T;
  index: number;
  columns: DataColumn<T>[];
  rowClassName?: (item: T, index: number) => string;
  mobileSummaryKeys?: string[];
  lastAlign?: 'left' | 'right';
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleColumns = columns.filter(c => c.visible !== false);
  const summaryColumns = mobileSummaryKeys?.length
    ? mobileSummaryKeys
        .map(key => visibleColumns.find(c => c.key === key))
        .filter((c): c is DataColumn<T> => c != null)
    : (() => {
        const first = visibleColumns[0];
        const last = visibleColumns[visibleColumns.length - 1];
        return first === last ? [first] : [first, last];
      })();
  const renderCol = (col: DataColumn<T>) => (col.renderMobile ?? col.render)(item, index);
  /** In expanded section show all columns with labels (including the summary ones). */
  const allColumnsForExpand = visibleColumns;

  return (
    <div
      className={cn(
        'border-b border-border/15 last:border-0',
        rowClassName?.(item, index),
      )}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center min-h-[44px] px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer overflow-x-auto"
      >
        {summaryColumns.length >= 4 ? (
          <div className="grid w-full min-w-0 items-center gap-x-2 sm:gap-x-3 flex-1" style={{ gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, 1fr) minmax(0, auto)' }}>
            <div className={cn('min-w-0 text-left', summaryColumns[0]?.cellClassName)}>
              {summaryColumns[0] && <span className="block min-w-0 break-words">{renderCol(summaryColumns[0])}</span>}
            </div>
            <div className={cn('min-w-0 overflow-hidden text-center flex justify-center', summaryColumns[1]?.cellClassName)}>
              {summaryColumns[1] && <span className="block truncate">{renderCol(summaryColumns[1])}</span>}
            </div>
            <div className={cn('min-w-0 overflow-hidden text-center flex justify-center', summaryColumns[2]?.cellClassName)}>
              {summaryColumns[2] && <span className="block truncate">{renderCol(summaryColumns[2])}</span>}
            </div>
            <div className={cn('flex shrink-0 items-center justify-end text-right text-xs', summaryColumns[3]?.cellClassName)}>
              {summaryColumns[3] && <span className="block whitespace-nowrap">{renderCol(summaryColumns[3])}</span>}
            </div>
          </div>
        ) : summaryColumns.length === 3 ? (
          <div className="grid w-full min-w-0 items-center gap-x-2 sm:gap-x-3 flex-1" style={{ gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)' }}>
            <div className={cn('min-w-0 text-left', summaryColumns[0]?.cellClassName)}>
              {summaryColumns[0] && <span className="block min-w-0 break-words">{renderCol(summaryColumns[0])}</span>}
            </div>
            <div className={cn('min-w-0 overflow-hidden text-center flex justify-center', summaryColumns[1]?.cellClassName)}>
              {summaryColumns[1] && <span className="block truncate">{renderCol(summaryColumns[1])}</span>}
            </div>
            <div className={cn('flex shrink-0 items-center justify-end text-right text-xs', summaryColumns[2]?.cellClassName)}>
              {summaryColumns[2] && <span className="block whitespace-nowrap">{renderCol(summaryColumns[2])}</span>}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className={cn('min-w-0 flex-1 text-left break-words', summaryColumns[0]?.cellClassName)}>
                {summaryColumns[0]?.render(item, index)}
              </div>
              <div className="flex items-center gap-1 shrink-0 justify-end text-right">
                {summaryColumns[1] && (
                  <div className={cn('whitespace-nowrap', summaryColumns[1].cellClassName)} onClick={e => e.stopPropagation()}>
                    {summaryColumns[1].render(item, index)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {expanded && allColumnsForExpand.length > 0 && (
        <div className="px-4 pb-3 pt-1 space-y-2 animate-fade-in bg-muted/5">
          {allColumnsForExpand.map(col => (
            <div key={col.key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground font-medium shrink-0">{col.header}</span>
              <div className={cn('flex min-w-0 text-xs', col.cellClassName?.includes('text-center') ? 'justify-center' : 'justify-end', col.cellClassName)}>
                {col.render(item, index)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DataTable<T>({
  data,
  columns,
  itemsPerPage = 15,
  page,
  onPageChange,
  emptyMessage = 'No data found',
  rowClassName,
  striped = false,
  className,
  totalItems: externalTotalItems,
  mobileSummaryKeys,
  mobileSummaryLastAlign = 'right',
  loading = false,
  minHeight,
}: DataTableProps<T>) {
  const visibleColumns = columns.filter(c => c.visible !== false);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const getSortValue = (item: T, key: string): string | number => {
    const v = (item as Record<string, unknown>)[key];
    if (v == null) return '';
    return typeof v === 'number' || typeof v === 'string' ? v : String(v);
  };

  const sortedData = useMemo(() => {
    if (!sortBy) return data;
    const key = sortBy;
    return [...data].sort((a, b) => {
      const va = getSortValue(a, key);
      const vb = getSortValue(b, key);
      const isNum = typeof va === 'number' && typeof vb === 'number';
      let cmp: number;
      if (isNum) cmp = (va as number) - (vb as number);
      else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortBy, sortDir]);

  const handleSort = (col: DataColumn<T>) => {
    const key = col.sortKey ?? col.key;
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
    onPageChange(1);
  };

  const clientPagination = usePagination(sortedData, itemsPerPage);
  const isServerPaginated = externalTotalItems !== undefined;
  const totalItems = isServerPaginated ? externalTotalItems : clientPagination.totalItems;
  const totalPages = isServerPaginated ? Math.max(1, Math.ceil((externalTotalItems ?? 0) / itemsPerPage)) : clientPagination.totalPages;
  const paged = isServerPaginated ? sortedData : clientPagination.paginate(page);

  const contentEmpty = loading || paged.length === 0;
  const applyMinHeight = contentEmpty && (minHeight ?? '260px');
  const skeletonRowCount = Math.min(itemsPerPage, SKELETON_ROWS_MAX);

  return (
    <div
      className={cn('bg-card border border-border/30 rounded-2xl overflow-hidden', className)}
      style={applyMinHeight ? { minHeight: applyMinHeight } : undefined}
    >
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/20 bg-muted/30">
              {visibleColumns.map(col => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'font-semibold text-[11px] h-9 px-3',
                    col.sortable && !loading && 'cursor-pointer select-none hover:bg-muted/50 transition-colors',
                    col.headerClassName,
                  )}
                  onClick={() => !loading && col.sortable && handleSort(col)}
                >
                  <div className={cn('flex items-center gap-1.5', col.headerClassName?.includes('text-center') && 'justify-center')}>
                    {col.header}
                    {col.sortable && !loading && (
                      <span className="inline-flex text-muted-foreground">
                        {sortBy !== (col.sortKey ?? col.key) ? (
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        ) : sortDir === 'asc' ? (
                          <ChevronUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-primary" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRowCount }).map((_, i) => (
                <TableRow key={i} className="border-border/15">
                  {visibleColumns.map(col => (
                    <TableCell key={col.key} className="px-3 py-2.5">
                      <div className="h-4 bg-muted/50 rounded animate-pulse w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <>
                {paged.map((item, i) => (
                  <TableRow
                    key={i}
                    className={cn(
                      'border-border/15 hover:bg-muted/20 transition-colors',
                      striped && i % 2 === 1 && 'bg-muted/10',
                      rowClassName?.(item, i),
                    )}
                  >
                    {visibleColumns.map(col => (
                      <TableCell key={col.key} className={cn('px-3 py-2.5', col.cellClassName)}>
                        {col.render(item, i)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length} className="text-center py-12 text-xs text-muted-foreground">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile collapsible rows — same structure as real rows so responsiveness unchanged */}
      <div className="md:hidden">
        {loading ? (
          Array.from({ length: skeletonRowCount }).map((_, i) => (
            <MobileSkeletonRow
              key={i}
              summaryColCount={mobileSummaryKeys?.length}
              lastAlign={mobileSummaryLastAlign}
            />
          ))
        ) : paged.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground px-4">{emptyMessage}</div>
        ) : (
          paged.map((item, i) => (
            <MobileRow
              key={i}
              item={item}
              index={i}
              columns={columns}
              rowClassName={rowClassName}
              mobileSummaryKeys={mobileSummaryKeys}
              lastAlign={mobileSummaryLastAlign}
            />
          ))
        )}
      </div>

      <MacPagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
      />
    </div>
  );
}
