import { useEffect, useMemo, useState } from 'react';
import { keysApi } from '@/lib/backend-keys';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { topToast as toast } from '@/lib/topToast';
import { Plus, Search, RotateCcw, Trash2, Filter, Ban, CircleCheck, User } from 'lucide-react';
import type { LicenseKey, KeyDuration, KeyStatus } from '@/lib/types';
import { durationLabels } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DataTable, type DataColumn } from '@/components/DataTable';
import { useAuth } from '@/contexts/AuthContext';

const supportedGenerateDurations: KeyDuration[] = ['trial', '1d', '7d', '30d'];

/** Key is "online" if last login was within this many ms (server uses 60s; we use 120s for display). */
const ONLINE_THRESHOLD_MS = 120 * 1000;

const isKeyOnline = (lastLogin: string | null): boolean => {
  if (!lastLogin) return false;
  const t = new Date(lastLogin).getTime();
  return Number.isFinite(t) && Date.now() - t < ONLINE_THRESHOLD_MS;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function AdminKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<KeyStatus | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [genOpen, setGenOpen] = useState(false);
  const [genDuration, setGenDuration] = useState<KeyDuration>('30d');
  const [availableGenerateDurations, setAvailableGenerateDurations] = useState<KeyDuration[]>(supportedGenerateDurations);
  const [genCount, setGenCount] = useState(1);
  const [maxGenerateCount, setMaxGenerateCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = () => keysApi.getAll().then(setKeys).catch(() => setKeys([]));
  useEffect(() => {
    load().finally(() => setTableLoading(false));
  }, []);

  /* Refresh key list periodically so online/offline dots stay up to date */
  useEffect(() => {
    const interval = setInterval(load, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    keysApi.getDurationAvailability()
      .then((settings) => {
        const roleSettings = user?.role === 'reseller' ? settings.reseller : settings.admin;
        const filtered = supportedGenerateDurations.filter((d) => roleSettings[d]);
        const nextDurations = filtered.length > 0 ? filtered : supportedGenerateDurations;
        setAvailableGenerateDurations(nextDurations);
        setGenDuration((prev) => (nextDurations.includes(prev) ? prev : nextDurations[0]));
      })
      .catch(() => {
        setAvailableGenerateDurations(supportedGenerateDurations);
      });
  }, [user?.role]);

  useEffect(() => {
    keysApi.getGenerateLimit()
      .then((nextMax) => setMaxGenerateCount(Math.max(1, nextMax)))
      .catch(() => setMaxGenerateCount(50));
  }, []);

  /* Jab bhi Generate dialog khule, server se latest limit fetch karo (admin + reseller dono ke liye). */
  useEffect(() => {
    if (!genOpen) return;
    keysApi.getGenerateLimit()
      .then((nextMax) => setMaxGenerateCount(Math.max(1, nextMax)))
      .catch(() => {});
  }, [genOpen]);

  useEffect(() => {
    setGenCount((prev) => Math.max(1, Math.min(maxGenerateCount, prev)));
  }, [maxGenerateCount]);

  const uniqueUsers = useMemo(() => {
    const set = new Set(keys.map(k => k.generatedBy).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [keys]);

  const filtered = keys.filter(k => {
    if (statusFilter !== 'all' && k.status !== statusFilter) return false;
    if (userFilter !== 'all' && k.generatedBy !== userFilter) return false;
    if (search && !k.key.toLowerCase().includes(search.toLowerCase()) && !k.generatedBy?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  useEffect(() => { setPage(1); }, [search, statusFilter, userFilter]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const newKeys = await keysApi.generate(genDuration, genCount);
      const text = newKeys.join('\n');
      try {
        await navigator.clipboard.writeText(text);
        toast.success(`Generated ${newKeys.length} key(s) and copied to clipboard`, 'Key generated');
      } catch {
        toast.success(`Generated ${newKeys.length} key(s)`, 'Key generated');
      }
      setGenOpen(false);
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate keys';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (license: string, reason: string) => {
    try {
      await keysApi.banKey(license, reason || 'Banned from panel');
      toast.success('License banned', 'Banned');
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to ban license';
      toast.error(message);
    }
  };
  const handleUnban = async (license: string) => {
    try {
      await keysApi.unbanKey(license);
      toast.success('License unbanned', 'Unbanned');
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unban license';
      toast.error(message);
    }
  };
  const handleResetHwid = async (id: string) => {
    try {
      await keysApi.resetHwid(id);
      toast.success('HWID reset', 'HWID reset');
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset HWID';
      toast.error(message);
    }
  };
  const handleDelete = async (id: string) => {
    try {
      await keysApi.deleteKey(id);
      toast.success('Key deleted', 'Deleted');
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete key';
      toast.error(message);
    }
  };
  const copyKey = (key: string) => { navigator.clipboard.writeText(key); toast.success('Key copied', 'Copied'); };

  const columns: DataColumn<LicenseKey>[] = [
    {
      key: 'key', header: 'License', sortable: true,
      render: (k) => {
        const online = isKeyOnline(k.lastLogin);
        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0 ring-1 ring-black/5',
                online ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-red-500/80',
              )}
              title={online ? 'Online' : 'Offline'}
            />
            <button onClick={() => copyKey(k.key)} className="font-mono text-xs sm:text-xs text-sm hover:text-primary transition-colors truncate">
              {k.key}
            </button>
          </div>
        );
      },
    },
    { key: 'createdAt', header: 'Created On', sortable: true, cellClassName: 'text-xs text-muted-foreground whitespace-nowrap', render: (k) => formatDate(k.createdAt) },
    { key: 'expiry', header: 'Expiry Time', sortable: true, sortKey: 'expiresAt', cellClassName: 'text-xs text-muted-foreground whitespace-nowrap', render: (k) => formatDate(k.expiresAt) },
    { key: 'lastLogin', header: 'Last Login', sortable: true, cellClassName: 'text-xs text-muted-foreground whitespace-nowrap', render: (k) => formatDate(k.lastLogin) },
    { key: 'model', header: 'Model', sortable: true, cellClassName: 'text-xs font-mono whitespace-nowrap min-w-[7rem]', render: (k) => k.model || '—' },
    { key: 'sdk', header: 'IOS', sortable: true, cellClassName: 'text-xs text-center', render: (k) => (
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 font-mono text-xs font-medium">
          {k.sdk ?? '—'}
        </span>
      ) },
    { key: 'generatedBy', header: 'Generated By', sortable: true, cellClassName: 'text-xs', render: (k) => k.generatedBy },
    {
      key: 'actions', header: 'Actions', headerClassName: 'text-right', cellClassName: 'text-right',
      render: (k) => {
        const keyUsed = !!(k.lastLogin || k.hwid);
        return (
        <div className="w-full flex items-center justify-end gap-0.5">
          {keyUsed && (
            k.status === 'revoked' ? (
              <Button variant="ghost" size="icon" onClick={() => handleUnban(k.key)} title="Unban" className="rounded-lg h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/15">
                <Ban className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => handleBan(k.key, 'Banned from panel')} title="Ban" className="rounded-lg h-7 w-7 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/15">
                <CircleCheck className="h-3.5 w-3.5" />
              </Button>
            )
          )}
          <Button variant="ghost" size="icon" onClick={() => handleResetHwid(k.id)} title="Reset HWID" className="rounded-lg h-7 w-7 text-amber-500 hover:text-amber-400 hover:bg-amber-500/15">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {user?.role === 'admin' && (
            <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)} title="Delete" className="rounded-lg h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/15">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        );
      },
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
            <Input placeholder="Search licenses..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-9 rounded-xl border border-border/30 bg-card/60 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="h-10 rounded-xl border border-border/30 bg-card/60 w-10 p-0 justify-center md:w-36 md:px-3 md:justify-start md:gap-1.5 [&>svg.lucide-chevron-down]:hidden md:[&>svg.lucide-chevron-down]:block [&>span]:hidden md:[&>span]:inline text-xs font-medium whitespace-nowrap md:[&>span]:whitespace-nowrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Ban</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          {user?.role === 'admin' && (
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-10 rounded-xl border border-border/30 bg-card/60 w-10 p-0 justify-center md:w-40 md:px-3 md:justify-start md:gap-1.5 [&>svg.lucide-chevron-down]:hidden md:[&>svg.lucide-chevron-down]:block [&>span]:hidden md:[&>span]:inline text-xs font-medium whitespace-nowrap md:[&>span]:whitespace-nowrap">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto hidden md:flex items-center gap-2 shrink-0 h-10">
            <span className="text-xs text-muted-foreground font-medium flex items-center h-10">{filtered.length} licenses</span>
            <Dialog open={genOpen} onOpenChange={setGenOpen}>
              <DialogTrigger asChild>
                <Button className="hidden md:inline-flex h-10 rounded-xl border border-primary/30 bg-primary text-primary-foreground shadow-md shadow-primary/20 gap-1.5 text-xs font-medium hover:bg-primary/90">
                  <Plus className="h-4 w-4" /> Generate
                </Button>
              </DialogTrigger>
            <DialogTrigger asChild>
              <Button size="icon" className="md:hidden fixed bottom-24 right-4 z-50 h-10 w-10 rounded-xl border border-primary/30 bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-2.5rem)] max-w-sm sm:max-w-md border-border/30 rounded-2xl p-0 overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                    Generate License Keys
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Create new license keys for distribution</p>
                </DialogHeader>
              </div>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-5">
                <div className="space-y-1.5 sm:space-y-2.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</Label>
                  <Select value={genDuration} onValueChange={v => setGenDuration(v as KeyDuration)}>
                    <SelectTrigger className="rounded-xl h-9 sm:h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableGenerateDurations.map((durationKey) => (
                        <SelectItem key={durationKey} value={durationKey}>
                          {durationLabels[durationKey]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:space-y-2.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantity</Label>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => setGenCount(Math.max(1, genCount - 1))}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all active:scale-95 text-lg font-medium"
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min={1}
                      max={maxGenerateCount}
                      value={genCount}
                      onChange={e => setGenCount(Math.max(1, Math.min(maxGenerateCount, +e.target.value)))}
                      className="rounded-xl h-9 sm:h-10 text-center text-sm font-semibold flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setGenCount(Math.min(maxGenerateCount, genCount + 1))}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-border/40 flex items-center justify-center text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all active:scale-95 text-lg font-medium"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Max {maxGenerateCount} keys per batch</p>
                </div>
                <Button onClick={handleGenerate} disabled={loading || availableGenerateDurations.length === 0} className="w-full rounded-xl h-10 sm:h-11 text-sm font-semibold shadow-lg shadow-primary/20 gap-2">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    <>Generate {genCount} Key{genCount > 1 ? 's' : ''}</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          page={page}
          onPageChange={setPage}
          itemsPerPage={15}
          emptyMessage="No licenses found"
          className="glass-card"
          loading={tableLoading}
        />
      </div>
    </DashboardLayout>
  );
}
