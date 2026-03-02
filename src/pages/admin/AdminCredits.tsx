import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { topToast as toast } from '@/lib/topToast';
import { Plus, Search, History, Users, Filter, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/backend-users';
import { formatINR } from '@/lib/utils';
import { DataTable, type DataColumn } from '@/components/DataTable';
import type { WalletLedgerEntry } from '@/lib/types';

type LedgerRow = WalletLedgerEntry & { beforeBalance: number };

function ledgerRowsFromEntries(entries: WalletLedgerEntry[]): LedgerRow[] {
  return entries.map(e => ({
    ...e,
    beforeBalance: e.type === 'credit' ? e.balanceAfter - e.amount : e.balanceAfter + e.amount,
  }));
}

export default function AdminCredits() {
  const { user } = useAuth();
  const [resellers, setResellers] = useState<Array<{ username: string; name: string; role: string; balance: number; licenses: number }>>([]);
  const [form, setForm] = useState({ resellerId: '', amount: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pricing, setPricing] = useState<{ nextDay?: number; nextWeek?: number; nextMonth?: number; nextTest?: number } | null>(null);
  const [ledgerFilterUser, setLedgerFilterUser] = useState<string>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledger, setLedger] = useState<{ total: number; entries: WalletLedgerEntry[] }>({ total: 0, entries: [] });
  const ledgerPageSize = 20;
  const [resellerLedgerPage, setResellerLedgerPage] = useState(1);
  const [resellerLedger, setResellerLedger] = useState<{ total: number; entries: WalletLedgerEntry[] }>({ total: 0, entries: [] });
  const [resellerLedgerSearch, setResellerLedgerSearch] = useState('');
  const [resellerLedgerTypeFilter, setResellerLedgerTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const resellerLedgerPageSize = 20;
  const [resellerLedgerLoading, setResellerLedgerLoading] = useState(true);
  const [walletUsersLoading, setWalletUsersLoading] = useState(true);
  const [walletLedgerLoading, setWalletLedgerLoading] = useState(true);

  const walletTabs = [
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'ledger' as const, label: 'Ledger', icon: History },
  ];
  const [activeTab, setActiveTab] = useState<'users' | 'ledger'>('users');

  const load = () => {
    return Promise.all([
      usersApi.getAssignedUsers().then(setResellers).catch(() => setResellers([])),
      usersApi.getRolePricing().then((data) => {
        const roleKey = user?.role === 'admin' ? 'admin' : 'reseller';
        const rolePricing = data?.rolePricing?.[roleKey];
        setPricing(rolePricing || null);
      }).catch(() => setPricing(null)),
    ]);
  };
  useEffect(() => {
    if (user?.role === 'admin') load().finally(() => setWalletUsersLoading(false));
  }, [user?.role]);
  useEffect(() => {
    if (user?.role === 'reseller') {
      setResellerLedgerLoading(true);
      usersApi.getWalletLedger('', resellerLedgerPage, resellerLedgerPageSize)
        .then(setResellerLedger)
        .catch(() => setResellerLedger({ total: 0, entries: [] }))
        .finally(() => setResellerLedgerLoading(false));
    }
  }, [user?.role, resellerLedgerPage]);

  const loadLedger = () => {
    if (user?.role !== 'admin') return Promise.resolve();
    return usersApi.getWalletLedger(ledgerFilterUser, ledgerPage, ledgerPageSize).then(setLedger).catch(() => setLedger({ total: 0, entries: [] }));
  };
  useEffect(() => {
    loadLedger().finally(() => setWalletLedgerLoading(false));
  }, [ledgerFilterUser, ledgerPage, user?.role]);

  const handleAdd = async () => {
    if (!form.resellerId || form.amount <= 0) return;
    setLoading(true);
    try {
      await usersApi.rechargeUser(form.resellerId, form.amount);
      toast.success('Added to wallet successfully!', 'Added');
      setForm({ resellerId: '', amount: 0 });
      setAddOpen(false);
      load();
      loadLedger();
    } catch {
      toast.error('Failed to add to wallet');
    }
    setLoading(false);
  };

  const filtered = resellers.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.username.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns: DataColumn<{ username: string; name: string; role: string; balance: number; licenses: number }>[] = [
    { key: 'name', header: 'Name', sortable: true, cellClassName: 'text-xs font-medium', render: (r) => r.name },
    { key: 'username', header: 'Username', sortable: true, cellClassName: 'text-xs font-mono text-muted-foreground', render: (r) => r.username },
    { key: 'role', header: 'Role', sortable: true, cellClassName: 'text-xs capitalize', render: (r) => r.role },
    { key: 'licenses', header: 'Licenses', sortable: true, cellClassName: 'text-xs', render: (r) => r.licenses },
    { key: 'balance', header: 'Balance', sortable: true, cellClassName: 'text-xs font-semibold text-left', render: (r) => formatINR(r.balance) },
  ];

  const resellersOnly = filtered.filter((r) => r.role === 'reseller');

  const ledgerColumns: DataColumn<LedgerRow>[] = [
    { key: 'username', header: 'User', sortable: true, cellClassName: 'text-xs font-mono', render: (r) => r.username },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortKey: 'timestamp',
      cellClassName: 'text-xs whitespace-nowrap text-muted-foreground',
      render: (r) => r.timestamp ? new Date(r.timestamp * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—',
    },
    { key: 'type', header: 'Type', sortable: true, cellClassName: 'text-xs capitalize', render: (r) => r.type },
    {
      key: 'beforeBalance',
      header: 'Before Balance',
      sortable: true,
      cellClassName: 'text-xs font-medium',
      render: (r) => formatINR(r.beforeBalance),
    },
    {
      key: 'balanceAfter',
      header: 'After Balance',
      sortable: true,
      cellClassName: 'text-xs font-medium',
      render: (r) => formatINR(r.balanceAfter),
    },
    {
      key: 'description',
      header: 'Description',
      cellClassName: 'text-xs text-muted-foreground max-w-[200px] truncate',
      render: (r) => r.description || '—',
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      cellClassName: 'text-xs font-medium text-left',
      render: (r) => (
        <span className={r.type === 'credit' ? 'text-emerald-600' : 'text-amber-600'}>
          {r.type === 'credit' ? '+' : '-'}{formatINR(r.amount)}
        </span>
      ),
    },
  ];

  const filteredLedgerRows = useMemo(() => {
    const rows = ledgerRowsFromEntries(ledger.entries);
    const q = ledgerSearch.trim().toLowerCase();
    const bySearch = q
      ? rows.filter(
          (r) =>
            r.username.toLowerCase().includes(q) ||
            (r.description || '').toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q)
        )
      : rows;
    return ledgerTypeFilter === 'all' ? bySearch : bySearch.filter((r) => r.type === ledgerTypeFilter);
  }, [ledger.entries, ledgerSearch, ledgerTypeFilter]);

  const filteredResellerLedgerRows = useMemo(() => {
    const rows = ledgerRowsFromEntries(resellerLedger.entries);
    const q = resellerLedgerSearch.trim().toLowerCase();
    const bySearch = q
      ? rows.filter(
          (r) =>
            (r.description || '').toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
        )
      : rows;
    return resellerLedgerTypeFilter === 'all' ? bySearch : bySearch.filter((r) => r.type === resellerLedgerTypeFilter);
  }, [resellerLedger.entries, resellerLedgerSearch, resellerLedgerTypeFilter]);

  const resellerLedgerColumns: DataColumn<LedgerRow>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortKey: 'timestamp',
      cellClassName: 'text-xs whitespace-nowrap text-muted-foreground',
      render: (r) => r.timestamp ? new Date(r.timestamp * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—',
    },
    { key: 'type', header: 'Type', sortable: true, cellClassName: 'text-xs capitalize', render: (r) => r.type },
    {
      key: 'beforeBalance',
      header: 'Before Balance',
      sortable: true,
      cellClassName: 'text-xs font-medium',
      render: (r) => formatINR(r.beforeBalance),
    },
    {
      key: 'balanceAfter',
      header: 'After Balance',
      sortable: true,
      cellClassName: 'text-xs font-medium',
      render: (r) => formatINR(r.balanceAfter),
    },
    {
      key: 'description',
      header: 'Description',
      cellClassName: 'text-xs text-muted-foreground max-w-[200px] truncate',
      render: (r) => r.description || (r.type === 'credit' ? 'Credit' : 'Debit'),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      cellClassName: 'text-xs font-medium text-left',
      render: (r) => (
        <span className={r.type === 'credit' ? 'text-emerald-600' : 'text-amber-600'}>
          {r.type === 'credit' ? '+' : '-'}{formatINR(r.amount)}
        </span>
      ),
    },
  ];

  if (user?.role === 'reseller') {
    return (
      <DashboardLayout>
        <div className="space-y-5">
          {/* Balance visible on mobile - compact like header */}
          <div className="md:hidden flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-card border border-border/40 shadow-sm">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold tracking-tight text-primary">{formatINR(user?.balance ?? 0)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
              <Input
                placeholder="Search transactions..."
                value={resellerLedgerSearch}
                onChange={(e) => setResellerLedgerSearch(e.target.value)}
                className="h-10 pl-9 rounded-xl border border-border/30 bg-card/60 text-sm"
              />
            </div>
            <Select
              value={resellerLedgerTypeFilter}
              onValueChange={(v) => setResellerLedgerTypeFilter(v as 'all' | 'credit' | 'debit')}
            >
              <SelectTrigger className="h-10 rounded-xl border border-border/30 bg-card/60 w-10 p-0 justify-center md:w-32 md:px-3 md:justify-start md:gap-1.5 [&>svg.lucide-chevron-down]:hidden md:[&>svg.lucide-chevron-down]:block [&>span]:hidden md:[&>span]:inline text-xs font-medium">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="credit">Credit (added)</SelectItem>
                <SelectItem value="debit">Debit (used)</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto hidden md:flex items-center shrink-0 h-10">
              <span className="text-xs text-muted-foreground font-medium flex items-center h-10">
                {resellerLedgerSearch.trim() || resellerLedgerTypeFilter !== 'all'
                  ? `${filteredResellerLedgerRows.length} on page · ${resellerLedger.total} total`
                  : `${resellerLedger.total} entries`}
              </span>
            </div>
          </div>
          <DataTable
            data={filteredResellerLedgerRows}
            columns={resellerLedgerColumns}
            page={resellerLedgerPage}
            onPageChange={setResellerLedgerPage}
            itemsPerPage={resellerLedgerPageSize}
            totalItems={resellerLedger.total}
            emptyMessage="No transactions yet."
            striped
            className="glass-card rounded-2xl overflow-hidden border border-border/30"
            mobileSummaryKeys={['date', 'type', 'amount']}
            mobileSummaryLastAlign="right"
            loading={resellerLedgerLoading}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 py-1">
          {walletTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 border ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25'
                  : 'border-border/30 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card/80'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
          <div className={`relative flex-1 min-w-[200px] max-w-sm ${activeTab === 'ledger' ? 'hidden md:block' : ''}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
            {activeTab === 'users' ? (
              <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-9 rounded-xl border border-border/30 bg-card/60 text-sm" />
            ) : (
              <Input
                placeholder="Search ledger..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="h-10 pl-9 rounded-xl border border-border/30 bg-card/60 text-sm"
              />
            )}
          </div>
          {activeTab === 'ledger' && (
            <>
              <Select
                value={ledgerFilterUser}
                onValueChange={(v) => {
                  setLedgerFilterUser(v);
                  setLedgerPage(1);
                }}
              >
                <SelectTrigger className="h-10 rounded-xl border border-border/30 bg-card/60 w-10 p-0 justify-center md:w-36 md:px-3 md:justify-start md:gap-1.5 [&>svg.lucide-chevron-down]:hidden md:[&>svg.lucide-chevron-down]:block [&>span]:hidden md:[&>span]:inline text-xs font-medium">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assigned users</SelectItem>
                  {filtered.map((r) => (
                    <SelectItem key={r.username} value={r.username}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={ledgerTypeFilter}
                onValueChange={(v) => setLedgerTypeFilter(v as 'all' | 'credit' | 'debit')}
              >
                <SelectTrigger className="h-10 rounded-xl border border-border/30 bg-card/60 w-10 p-0 justify-center md:w-32 md:px-3 md:justify-start md:gap-1.5 [&>svg.lucide-chevron-down]:hidden md:[&>svg.lucide-chevron-down]:block [&>span]:hidden md:[&>span]:inline text-xs font-medium">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          <div className="ml-auto hidden md:flex items-center gap-2 shrink-0 h-10">
            <span className="text-xs text-muted-foreground font-medium flex items-center h-10">
              {activeTab === 'users'
                ? `${filtered.length} users`
                : ledgerSearch.trim() || ledgerTypeFilter !== 'all'
                  ? `${filteredLedgerRows.length} on page · ${ledger.total} total`
                  : `${ledger.total} entries`}
            </span>
            {activeTab === 'users' && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="hidden md:inline-flex h-10 rounded-xl border border-primary/30 bg-primary text-primary-foreground shadow-md shadow-primary/20 gap-1.5 shrink-0 text-xs font-medium hover:bg-primary/90">
                  <Plus className="h-4 w-4" /> Top Up
                </Button>
              </DialogTrigger>
              <DialogTrigger asChild>
                <Button size="icon" className="md:hidden fixed bottom-24 right-4 z-50 h-10 w-10 rounded-xl border border-primary/30 bg-primary text-primary-foreground shadow-lg shadow-primary/30 shrink-0">
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
                      Balance Top Up
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Add balance to a reseller wallet</p>
                  </DialogHeader>
                </div>
                <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reseller</Label>
                    <Select value={form.resellerId} onValueChange={v => setForm(f => ({ ...f, resellerId: v }))}>
                      <SelectTrigger className="rounded-xl h-9 sm:h-10"><SelectValue placeholder="Select reseller" /></SelectTrigger>
                      <SelectContent>
                        {resellersOnly.map(r => (
                          <SelectItem key={r.username} value={r.username}>{r.name} ({formatINR(r.balance)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</Label>
                    <Input type="number" min={1} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} className="rounded-xl h-9 sm:h-10" />
                  </div>
                  <Button onClick={handleAdd} className="w-full rounded-xl h-10 sm:h-11 text-sm font-semibold shadow-lg shadow-primary/20" disabled={!form.resellerId || form.amount <= 0 || loading}>
                    {loading ? 'Adding...' : 'Add to Wallet'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {activeTab === 'users' && (
          <DataTable
              data={filtered}
              columns={columns}
              page={page}
              onPageChange={setPage}
              itemsPerPage={15}
              emptyMessage="No users found"
              striped
              mobileSummaryKeys={['name', 'role', 'balance']}
              mobileSummaryLastAlign="right"
              loading={walletUsersLoading}
            />
        )}

        {activeTab === 'ledger' && (
          <DataTable
              data={filteredLedgerRows}
              columns={ledgerColumns}
              page={ledgerPage}
              onPageChange={setLedgerPage}
              itemsPerPage={ledgerPageSize}
              totalItems={ledger.total}
              emptyMessage="No ledger entries"
              striped
              className="glass-card rounded-2xl overflow-hidden border border-border/30"
              mobileSummaryKeys={['date', 'type', 'amount']}
              mobileSummaryLastAlign="right"
              loading={walletLedgerLoading}
            />
        )}
      </div>
    </DashboardLayout>
  );
}
