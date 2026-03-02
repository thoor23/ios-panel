import { useEffect, useState, useMemo, useRef } from 'react';
import { Key, Users, TrendingUp, Activity } from 'lucide-react';
import { dashboardApi, type AdminOverviewStats } from '@/lib/backend-dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/StatCard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyChartDataByRange: Record<string, { time: string; users: number }[]> = {
  Today: [],
  Week: [],
  Month: [],
};

const timeRanges = ['Today', 'Week', 'Month'] as const;
const CHART_HEIGHT = 280;
const Y_AXIS_WIDTH = 24;
const PIXELS_PER_POINT_TODAY = 10;
const AUTO_REFRESH_MS = 60_000; // graph time ke saath update (1 min)

/** Format analytics bucket timestamp. Today = 5-min labels (00:00, 00:05, 00:10...). */
function formatChartTime(timestamp: number, range: string): string {
  const d = new Date(timestamp * 1000);
  if (range === 'Today') {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  if (range === 'Week') {
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getNiceYMax(dataMax: number): number {
  if (dataMax <= 0) return 5;
  const pad = Math.max(dataMax * 1.05, dataMax + 1);
  if (pad <= 10) return Math.min(10, Math.ceil(pad));
  if (pad <= 100) return Math.ceil(pad / 10) * 10;
  return Math.ceil(pad / 50) * 50;
}

const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload?: { time: string } }> }) => {
  if (!active || !payload?.length) return null;
  const timeLabel = payload[0]?.payload?.time ?? '—';
  return (
    <div className="rounded-lg border border-border/40 bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-lg">
      <span className="text-muted-foreground text-xs block">{timeLabel}</span>
      <span className="tabular-nums text-primary font-semibold">{payload[0].value} active</span>
    </div>
  );
};

export default function AdminOverview() {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [chartDataByRange, setChartDataByRange] = useState<Record<string, { time: string; users: number }[]>>(emptyChartDataByRange);
  const [timeRange, setTimeRange] = useState<string>('Today');
  const [isDragging, setIsDragging] = useState(false);
  const [lastDataAt, setLastDataAt] = useState<number>(0);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [overview, today, week, month] = await Promise.all([
          dashboardApi.getOverviewStats(user?.role === 'admin' ? 'admin' : 'reseller'),
          dashboardApi.getAnalytics(24),
          dashboardApi.getAnalytics(24 * 7),
          dashboardApi.getAnalytics(24 * 30),
        ]);
        if (!isMounted) return;
        setStats(overview);
        setChartDataByRange({
          Today: today.map((x) => ({ time: formatChartTime(x.timestamp, 'Today'), users: x.active })),
          Week: week.map((x) => ({ time: formatChartTime(x.timestamp, 'Week'), users: x.active })),
          Month: month.map((x) => ({ time: formatChartTime(x.timestamp, 'Month'), users: x.active })),
        });
        setLastDataAt(Date.now());
      } catch {
        if (!isMounted) return;
        setStats({
          totalKeys: 0,
          onlineUsers: 0,
          activeUsers24h: 0,
          totalUsers: 0,
          totalBalance: 0,
          totalLicenses: 0,
        });
      }
    };
    void load();
    const t = setInterval(load, AUTO_REFRESH_MS);
    return () => {
      isMounted = false;
      clearInterval(t);
    };
  }, [user?.role]);

  const chartData = chartDataByRange[timeRange] || [];
  const maxUsersFromData = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.max(...chartData.map((d) => d.users), 0);
  }, [chartData]);
  const allZeros = (stats?.onlineUsers ?? 0) === 0 && maxUsersFromData === 0;
  const maxY = allZeros ? 0 : Math.max(maxUsersFromData, 1);
  const yDomain = allZeros ? ([0, 1] as const) : ([0, getNiceYMax(maxY)] as const);

  const isToday5Min = timeRange === 'Today' && chartData.length > 24;
  const chartWidth = isToday5Min ? Math.max(chartData.length * PIXELS_PER_POINT_TODAY, 1200) : undefined;

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!scrollRef.current || !isToday5Min) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setIsDragging(true);
    dragStart.current = { x, scrollLeft: scrollRef.current.scrollLeft };
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = dragStart.current.x - x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft + delta;
  };

  const handlePointerUp = () => setIsDragging(false);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!scrollRef.current) return;
      const delta = dragStart.current.x - e.clientX;
      scrollRef.current.scrollLeft = dragStart.current.scrollLeft + delta;
      dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // Default scroll to end = show current last 5 min (latest time on right); user can scroll left for past
  useEffect(() => {
    if (!isToday5Min || !scrollRef.current || !chartWidth) return;
    const el = scrollRef.current;
    const scrollToEnd = () => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    };
    scrollToEnd();
    const t = requestAnimationFrame(scrollToEnd);
    const t2 = setTimeout(scrollToEnd, 100);
    return () => {
      cancelAnimationFrame(t);
      clearTimeout(t2);
    };
  }, [isToday5Min, chartWidth, chartData.length, lastDataAt]);

  const xAxisInterval = isToday5Min ? 11 : undefined; // har ~12th label (har 1 hr) taaki readable rahein, overlap na ho

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatCard title="Total Keys" value={stats.totalKeys} icon={Key} description={`${stats.totalLicenses} licenses`} color="mint" delay={0} />
            <StatCard title="Live Users" value={stats.onlineUsers} icon={Users} description="Currently online" color="peach" delay={100} />
            <StatCard title="Active (24h)" value={stats.activeUsers24h} icon={TrendingUp} color="sky" delay={200} />
            <StatCard
              title={user?.role === 'admin' ? 'Total Resellers' : 'My Account'}
              value={stats.totalUsers}
              icon={Activity}
              description={user?.role === 'admin' ? 'Panel accounts' : 'Reseller profile'}
              color="lavender"
              delay={300}
            />
          </div>
        )}

        <div className="glass-card p-4 pb-2 opacity-0 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Online Users</h3>
              </div>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[160px] h-10 rounded-xl border border-border/30 bg-card/60 text-xs font-medium">
                  <SelectValue>Show by {timeRange.toLowerCase()}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {timeRanges.map((range) => (
                    <SelectItem key={range} value={range} className="text-xs">
                      Show by {range.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
            </div>
          </div>

          {isToday5Min ? (
            <div className="flex rounded-lg overflow-hidden">
              {/* Fixed Y-axis - minimal width, no extra space */}
              <div className="flex-shrink-0 bg-transparent" style={{ width: Y_AXIS_WIDTH }}>
                <ResponsiveContainer width={Y_AXIS_WIDTH} height={CHART_HEIGHT}>
                  <AreaChart data={chartData} margin={0}>
                    <YAxis
                      dataKey="users"
                      type="number"
                      domain={yDomain}
                      tick={{ fontSize: 10 }}
                      stroke="hsl(220, 9%, 46%)"
                      axisLine={false}
                      tickLine={false}
                      width={Y_AXIS_WIDTH}
                      tickFormatter={(v) => String(v)}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Scrollable chart body */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-x-auto overflow-y-hidden touch-pan-x cursor-grab active:cursor-grabbing select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-muted/30 dark:bg-muted/10 rounded-r-lg"
                style={{ WebkitOverflowScrolling: 'touch' }}
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onTouchCancel={handlePointerUp}
                onMouseLeave={handlePointerUp}
              >
                <div style={{ width: chartWidth }}>
                  <ResponsiveContainer width={chartWidth} height={CHART_HEIGHT}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="onlineGradScroll" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="lineStrokeGradScroll" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(173, 80%, 40%)" />
                          <stop offset="35%" stopColor="hsl(142, 71%, 45%)" />
                          <stop offset="70%" stopColor="hsl(199, 89%, 48%)" />
                          <stop offset="100%" stopColor="hsl(221, 83%, 53%)" />
                        </linearGradient>
                        <filter id="lineShadowScroll" x="-20%" y="-10%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="hsl(142, 71%, 45%)" floodOpacity="0.25" />
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical horizontal className="dark:stroke-border/50" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 12, fontWeight: 500 }}
                        stroke="hsl(220, 9%, 46%)"
                        axisLine={false}
                        tickLine={false}
                        interval={xAxisInterval}
                      />
                      <YAxis hide domain={yDomain} width={0} />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={false}
                        wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', outline: 'none' }}
                        contentStyle={{ background: 'transparent', border: 'none', padding: 0 }}
                      />
                      <Area
                        type="linear"
                        baseValue={0}
                        dataKey="users"
                        name="Online"
                        stroke="url(#lineStrokeGradScroll)"
                        strokeWidth={2.5}
                        fill="url(#onlineGradScroll)"
                        filter="url(#lineShadowScroll)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
          <div
            ref={scrollRef}
            className="rounded-lg overflow-x-auto overflow-y-hidden bg-muted/30 dark:bg-muted/10 touch-pan-x"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onMouseDown={isToday5Min ? handlePointerDown : undefined}
            onTouchStart={isToday5Min ? handlePointerDown : undefined}
            onTouchMove={isToday5Min ? handlePointerMove : undefined}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
            onMouseLeave={handlePointerUp}
          >
            <div style={chartWidth ? { width: chartWidth, minWidth: '100%' } : undefined}>
              <ResponsiveContainer width={chartWidth ?? '100%'} height={CHART_HEIGHT}>
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lineStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(173, 80%, 40%)" />
                      <stop offset="35%" stopColor="hsl(142, 71%, 45%)" />
                      <stop offset="70%" stopColor="hsl(199, 89%, 48%)" />
                      <stop offset="100%" stopColor="hsl(221, 83%, 53%)" />
                    </linearGradient>
                    <filter id="lineShadow" x="-20%" y="-10%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="hsl(142, 71%, 45%)" floodOpacity="0.25" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical horizontal className="dark:stroke-border/50" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    stroke="hsl(220, 9%, 46%)"
                    axisLine={false}
                    tickLine={false}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={yDomain}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(220, 9%, 46%)"
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={false}
                    wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', outline: 'none' }}
                    contentStyle={{ background: 'transparent', border: 'none', padding: 0 }}
                  />
                  <Area
                    type="linear"
                    baseValue={0}
                    dataKey="users"
                    name="Online"
                    stroke="url(#lineStrokeGrad)"
                    strokeWidth={2.5}
                    fill="url(#onlineGrad)"
                    filter="url(#lineShadow)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
