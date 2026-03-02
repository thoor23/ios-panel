import { cn } from '@/lib/utils';
import type { KeyStatus } from '@/lib/types';

const statusConfig: Record<KeyStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/15 text-success border-success/20' },
  expired: { label: 'Expired', className: 'bg-warning/15 text-warning border-warning/20' },
  revoked: { label: 'Revoked', className: 'bg-destructive/15 text-destructive border-destructive/20' },
  unassigned: { label: 'Unassigned', className: 'bg-muted text-muted-foreground border-border' },
};

export function StatusBadge({ status }: { status: KeyStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
