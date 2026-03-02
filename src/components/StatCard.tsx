import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type CardColor = 'mint' | 'peach' | 'lavender' | 'sky';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  color?: CardColor;
  className?: string;
  delay?: number;
}

const colorMap: Record<CardColor, { bg: string; icon: string }> = {
  mint: { bg: 'bg-[hsl(var(--card-mint))]', icon: 'text-[hsl(var(--card-mint-icon))] bg-[hsl(var(--card-mint-icon)/0.15)]' },
  peach: { bg: 'bg-[hsl(var(--card-peach))]', icon: 'text-[hsl(var(--card-peach-icon))] bg-[hsl(var(--card-peach-icon)/0.15)]' },
  lavender: { bg: 'bg-[hsl(var(--card-lavender))]', icon: 'text-[hsl(var(--card-lavender-icon))] bg-[hsl(var(--card-lavender-icon)/0.15)]' },
  sky: { bg: 'bg-[hsl(var(--card-sky))]', icon: 'text-[hsl(var(--card-sky-icon))] bg-[hsl(var(--card-sky-icon)/0.15)]' },
};

export function StatCard({ title, value, icon: Icon, description, color = 'mint', className, delay = 0 }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={cn(
        'widget-card rounded-2xl p-3 sm:p-5 opacity-0 animate-fade-in',
        colors.bg,
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-end justify-between">
        <div className="space-y-1 sm:space-y-1.5 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{description}</p>
          )}
        </div>
        <div className={cn('h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0', colors.icon)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}
