import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Users, DollarSign, KeyRound, Trash2, Clock, ChevronDown, Edit2, Lock, UserX, RefreshCw, Settings, Wrench, Download, Eye, EyeOff, Ban, IndianRupee, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { keysApi, type BackupScheduleSettings, type CleanupAgeRange, type CornIntervalUnit, type CustomLicenseDuration, type ExtendUnit, type HwidResetPeriod, type RoleDurationAvailability } from '@/lib/backend-keys';
import { keyPricing, durationLabels, getDurationDisplayLabel, type KeyDuration, type LicenseKey } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { topToast as toast, formatRoleForDisplay } from '@/lib/topToast';
import { useAuth } from '@/contexts/AuthContext';
import { formatINR } from '@/lib/utils';

const tabs = [
  { id: 'license', label: 'License', icon: KeyRound },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = typeof tabs[number]['id'];

export default function AdminManagement() {
  const [activeTab, setActiveTab] = useState<TabId>('license');

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2 py-1">
          {tabs.map(tab => (
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
        </div>

        
        {activeTab === 'license' && <LicenseTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </DashboardLayout>
  );
}

// ─── User Management ───
function UserManagementTab() {
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  type ManagedUser = { id: string; name: string; username: string; password: string; role: 'admin' | 'reseller'; balance: number; licenses: number; lastActive: string; assignTo: string; status: 'active' | 'disabled' | 'banned' };
  const [users, setUsers] = useState<ManagedUser[]>([]);

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateRole = (id: string, newRole: 'admin' | 'reseller') => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
    toast.success(`Role updated to ${formatRoleForDisplay(newRole)}`, 'Role updated');
  };

  const updateAssignTo = (id: string, assignTo: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, assignTo } : u));
    toast.success(`Assigned to ${assignTo}`, 'Assigned');
  };

  const banUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'banned' ? 'active' : 'banned' } : u));
    const user = users.find(u => u.id === id);
    if (user?.status === 'banned') {
      toast.success(`${user.name} unbanned`, 'Unbanned');
    } else {
      toast.error(`${user?.name} banned`);
    }
  };

  const adminUsers = users.filter(u => u.role === 'admin').map(u => u.name);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => {
    const date = new Date(d);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}, ${dd}-${mm}-${yyyy} ${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">User Management</h2>
          <p className="text-[11px] text-muted-foreground">{users.length} users total</p>
        </div>
        <Input
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48 h-8 text-xs"
        />
      </div>

      <div className="glass-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-[11px] h-9 px-3">Name</TableHead>
                <TableHead className="text-[11px] h-9 px-3">Username</TableHead>
                <TableHead className="text-[11px] h-9 px-3">Password</TableHead>
                <TableHead className="text-[11px] h-9 px-3">Role</TableHead>
                <TableHead className="text-[11px] h-9 px-3">Balance</TableHead>
                <TableHead className="text-[11px] h-9 px-3">Licenses</TableHead>
                <TableHead className="text-[11px] h-9 px-3">Last Active</TableHead>
                <TableHead className="text-[11px] h-9 px-3">Assign To</TableHead>
                <TableHead className="text-[11px] h-9 px-3 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(user => (
                <TableRow key={user.id} className={`border-border/30 ${user.status === 'banned' ? 'text-destructive' : ''}`}>
                  <TableCell className="text-xs px-3 py-2.5 font-medium">{user.name}</TableCell>
                  <TableCell className="text-xs px-3 py-2.5 font-mono text-muted-foreground">{user.username}</TableCell>
                  <TableCell className="text-xs px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-muted-foreground">
                        {visiblePasswords[user.id] ? user.password : '••••••••'}
                      </span>
                      <button onClick={() => togglePassword(user.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {visiblePasswords[user.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs px-3 py-2.5">
                    <Select value={user.role} onValueChange={v => updateRole(user.id, v as 'admin' | 'reseller')}>
                      <SelectTrigger className="h-7 w-24 text-[10px] rounded-lg border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="reseller">Reseller</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-0.5">
                      <IndianRupee className="h-3 w-3" />
                      {formatINR(user.balance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs px-3 py-2.5">{user.licenses}</TableCell>
                  <TableCell className="text-xs px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(user.lastActive)}</TableCell>
                  <TableCell className="text-xs px-3 py-2.5">
                    <Select value={user.assignTo} onValueChange={v => updateAssignTo(user.id, v)}>
                      <SelectTrigger className="h-7 w-28 text-[10px] rounded-lg border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="—">None</SelectItem>
                        {adminUsers.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs px-3 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => toast.info(`Editing ${user.name}`)}>
                          <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info(`Password dialog for ${user.name}`)}>
                          <Lock className="h-3.5 w-3.5 mr-2" /> Change Password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => banUser(user.id)}
                          className={user.status === 'banned' ? '' : 'text-warning focus:text-warning'}
                        >
                          <Ban className="h-3.5 w-3.5 mr-2" /> {user.status === 'banned' ? 'Unban User' : 'Ban User'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => toast.error(`${user.name} removed`)}
                        >
                          <UserX className="h-3.5 w-3.5 mr-2" /> Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── License (Pricing + Custom) ───
function LicenseTab() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [selectedPriceRole, setSelectedPriceRole] = useState<'admin' | 'reseller'>('admin');
  const [prices, setPrices] = useState<Record<'admin' | 'reseller', Record<KeyDuration, number>>>({
    admin: { ...keyPricing },
    reseller: { trial: 0, '1d': 2, '7d': 4, '30d': 8 },
  });
  const [durationAvailability, setDurationAvailability] = useState<RoleDurationAvailability>({
    admin: { trial: true, '1d': true, '7d': true, '30d': true },
    reseller: { trial: true, '1d': true, '7d': true, '30d': true },
  });
  const [updatingDurationKey, setUpdatingDurationKey] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [customDuration, setCustomDuration] = useState<CustomLicenseDuration>('30d');
  const [generatedCustomKey, setGeneratedCustomKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [singleKey, setSingleKey] = useState('');
  const [extendDays, setExtendDays] = useState('7');
  const [singleExtendUnit, setSingleExtendUnit] = useState<ExtendUnit>('day');
  const [bulkDays, setBulkDays] = useState('7');
  const [allExtendUnit, setAllExtendUnit] = useState<ExtendUnit>('day');
  const [durationRoleView, setDurationRoleView] = useState<'admin' | 'reseller'>('admin');
  const [savingPricing, setSavingPricing] = useState(false);
  const [extendingSingle, setExtendingSingle] = useState(false);
  const [extendingAll, setExtendingAll] = useState(false);

  const customDurationLabels: Record<CustomLicenseDuration, string> = {
    '30d': '30 Days',
    '6m': '6 Month',
    '1y': '1 Year',
    '2y': '2 Year',
    '3y': '3 Year',
  };
  const isAdminUser = user?.role === 'admin';
  const extendableKeysCount = keys.filter((k) => Boolean(k.expiresAt)).length;
  

  useEffect(() => {
    keysApi.getAll().then(setKeys).catch(() => setKeys([]));
    keysApi.getDurationAvailability()
      .then((settings) => {
        setDurationAvailability(settings);
      })
      .catch(() => {
        // Keep current defaults if backend settings call fails.
      });
    keysApi.getRolePricingSettings()
      .then((settings) => {
        setPrices(settings);
      })
      .catch(() => {
        // Keep current defaults if backend pricing call fails.
      });
  }, []);

  const handlePriceChange = (role: 'admin' | 'reseller', dur: KeyDuration, value: string) => {
    const num = parseInt(value) || 0;
    setPrices(prev => ({ ...prev, [role]: { ...prev[role], [dur]: num } }));
  };

  const toggleDuration = async (role: 'admin' | 'reseller', dur: KeyDuration) => {
    const nextSettings: RoleDurationAvailability = {
      ...durationAvailability,
      [role]: {
        ...durationAvailability[role],
        [dur]: !durationAvailability[role][dur],
      },
    };
    setDurationAvailability(nextSettings);
    setUpdatingDurationKey(`${role}-${dur}`);
    try {
      await keysApi.updateDurationAvailability(nextSettings);
      toast.success(`${formatRoleForDisplay(role)} ${durationLabels[dur]} ${nextSettings[role][dur] ? 'enabled' : 'disabled'}`, 'Saved');
    } catch (err) {
      setDurationAvailability(durationAvailability);
      const message = err instanceof Error ? err.message : 'Failed to update duration availability';
      toast.error(message);
    } finally {
      setUpdatingDurationKey(null);
    }
  };

  const handleSavePricing = async () => {
    setSavingPricing(true);
    try {
      await keysApi.updateRolePricingSettings(prices);
      toast.success('License pricing updated', 'Pricing updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update pricing';
      toast.error(message);
    } finally {
      setSavingPricing(false);
    }
  };

  const handleExtendSingle = async () => {
    if (!isAdminUser) {
      toast.error('Admin access required');
      return;
    }
    if (!singleKey.trim()) {
      toast.error('Enter a key first');
      return;
    }
    const amount = Number.parseInt(extendDays, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    setExtendingSingle(true);
    try {
      await keysApi.extendSingleKey(singleKey.trim(), amount, singleExtendUnit);
      toast.success(`Extended ${singleKey.trim()} by ${amount} ${singleExtendUnit}`, 'Extended');
      setSingleKey('');
      const latest = await keysApi.getAll();
      setKeys(latest);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extend key';
      toast.error(message);
    } finally {
      setExtendingSingle(false);
    }
  };

  const handleExtendAll = async () => {
    if (!isAdminUser) {
      toast.error('Admin access required');
      return;
    }
    const amount = Number.parseInt(bulkDays, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    setExtendingAll(true);
    try {
      const response = await keysApi.extendAllKeys(amount, allExtendUnit);
      toast.success(response || `Extended all keys by ${amount} ${allExtendUnit}`, 'Extended');
      const latest = await keysApi.getAll();
      setKeys(latest);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extend all keys';
      toast.error(message);
    } finally {
      setExtendingAll(false);
    }
  };

  const handleGenerateCustomLicense = async () => {
    if (!customText.trim()) {
      toast.error('Enter custom text');
      return;
    }
    setGenerating(true);
    try {
      const key = await keysApi.generateCustomLicense(customText, customDuration);
      setGeneratedCustomKey(key);
      toast.success('Custom license generated', 'Key generated');

      // Refresh table best-effort; generation should stay successful even if refresh fails.
      try {
        const latestKeys = await keysApi.getAll();
        setKeys(latestKeys);
      } catch {
        // Ignore refresh failure to avoid showing false-negative generation errors.
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate keys';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">License</h2>
        <p className="text-[11px] text-muted-foreground">Manage pricing, duration availability & create custom licenses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TOP LEFT — Duration Toggles */}
        <div className="glass-card p-4 space-y-3 order-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold">Duration Availability</h3>
            <Select value={durationRoleView} onValueChange={(v) => setDurationRoleView(v as 'admin' | 'reseller')}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="reseller">Reseller</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border/40 p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(durationLabels) as KeyDuration[]).map((dur) => (
              <div key={`${durationRoleView}-${dur}`} className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-3 py-2">
                <span className="text-xs font-medium">{durationLabels[dur]}</span>
                <Switch
                  checked={durationAvailability[durationRoleView][dur]}
                  onCheckedChange={() => toggleDuration(durationRoleView, dur)}
                  className="scale-75"
                  disabled={updatingDurationKey === `${durationRoleView}-${dur}`}
                />
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* TOP RIGHT — Generate License */}
        <div className="glass-card p-4 space-y-3 order-3">
          <h3 className="text-xs font-semibold flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            Custom License Generate
          </h3>
          <p className="text-[10px] text-muted-foreground">Create custom key with selected duration (30 days to 3 year)</p>
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-medium">Custom Text</label>
              <Input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. VIP, PROD, CLIENT"
                className="h-9 text-xs"
                disabled={!isAdminUser || generating}
              />
            </div>
            <div className="space-y-1.5 w-36">
              <label className="text-xs font-medium">Duration</label>
              <Select value={customDuration} onValueChange={v => setCustomDuration(v as CustomLicenseDuration)}>
                <SelectTrigger className="h-9 text-xs" disabled={!isAdminUser || generating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(customDurationLabels) as CustomLicenseDuration[]).map((d) => (
                    <SelectItem key={d} value={d}>{customDurationLabels[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateCustomLicense} className="rounded-xl h-9" size="sm" disabled={!isAdminUser || generating}>
              <KeyRound className="h-3.5 w-3.5 mr-1" /> {generating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
          {!isAdminUser && (
            <p className="text-[10px] text-muted-foreground">Custom license generation is admin-only.</p>
          )}
          {generatedCustomKey && (
            <div className="bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-1">Generated Custom Key</p>
              <p className="text-xs font-mono break-all">{generatedCustomKey}</p>
            </div>
          )}
        </div>

        {/* BOTTOM LEFT — Pricing */}
        <div className="glass-card p-4 space-y-3 order-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold">Pricing</h3>
            <div className="flex items-center gap-2">
              <Select value={selectedPriceRole} onValueChange={(v) => setSelectedPriceRole(v as 'admin' | 'reseller')}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="reseller">Reseller</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSavePricing} className="rounded-xl h-8 px-3 text-xs" size="sm" disabled={savingPricing}>
                {savingPricing ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(durationLabels) as KeyDuration[]).map(dur => (
              <div key={dur} className={`space-y-1 ${!durationAvailability.admin[dur] ? 'opacity-40' : ''}`}>
                <label className="text-[10px] text-muted-foreground">{durationLabels[dur]}</label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">INR</span>
                  <Input type="number" min={0} value={prices[selectedPriceRole][dur]} onChange={e => handlePriceChange(selectedPriceRole, dur, e.target.value)} className="h-8 text-xs w-full" disabled={!durationAvailability[selectedPriceRole][dur]} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM RIGHT — Extend Keys */}
        <div className="glass-card p-4 space-y-4 order-4">
          <h3 className="text-xs font-semibold flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Extend Keys
          </h3>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">Single Key</label>
            <div className="flex gap-2">
              <Input placeholder="Enter license key..." value={singleKey} onChange={e => setSingleKey(e.target.value)} className="h-9 text-xs flex-1 font-mono" disabled={!isAdminUser || extendingSingle || extendingAll} />
              <Input type="number" min={1} value={extendDays} onChange={e => setExtendDays(e.target.value)} className="h-9 text-xs w-16" placeholder="Amount" disabled={!isAdminUser || extendingSingle || extendingAll} />
              <Select value={singleExtendUnit} onValueChange={(v) => setSingleExtendUnit(v as ExtendUnit)}>
                <SelectTrigger className="h-9 text-xs w-24" disabled={!isAdminUser || extendingSingle || extendingAll}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="rounded-xl h-9" onClick={handleExtendSingle} disabled={!isAdminUser || extendingSingle || extendingAll}>
                {extendingSingle ? 'Extending...' : 'Extend'}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground">All Extendable Keys ({extendableKeysCount})</label>
            <div className="flex gap-2">
              <Input type="number" min={1} value={bulkDays} onChange={e => setBulkDays(e.target.value)} className="h-9 text-xs w-20" placeholder="Amount" disabled={!isAdminUser || extendingSingle || extendingAll} />
              <Select value={allExtendUnit} onValueChange={(v) => setAllExtendUnit(v as ExtendUnit)}>
                <SelectTrigger className="h-9 text-xs w-24" disabled={!isAdminUser || extendingSingle || extendingAll}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="rounded-xl h-9" onClick={handleExtendAll} disabled={!isAdminUser || extendingSingle || extendingAll || extendableKeysCount === 0}>
                {extendingAll ? 'Extending...' : `Extend All (${extendableKeysCount})`}
              </Button>
            </div>
          </div>
          {!isAdminUser && (
            <p className="text-[10px] text-muted-foreground">Extend keys is admin-only.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Settings ───
function SettingsTab() {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [maxLicenseGen, setMaxLicenseGen] = useState('50');
  const [maxHwidReset, setMaxHwidReset] = useState('3');
  const [hwidResetPeriod, setHwidResetPeriod] = useState<HwidResetPeriod>('day');
  const [savingKeySettings, setSavingKeySettings] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('System is under maintenance. Please try again later.');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [cornEnabled, setCornEnabled] = useState(false);
  const [cornIntervalValue, setCornIntervalValue] = useState('24');
  const [cornIntervalUnit, setCornIntervalUnit] = useState<CornIntervalUnit>('hours');
  const [savingCornSettings, setSavingCornSettings] = useState(false);
  const [cleanupRange, setCleanupRange] = useState<CleanupAgeRange>('15d');
  const [cleaningUp, setCleaningUp] = useState(false);
  const [backups, setBackups] = useState<{ name: string; size: number }[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<{ id: string; name: string } | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [backupScheduleEnabled, setBackupScheduleEnabled] = useState(false);
  const [backupScheduleIntervalValue, setBackupScheduleIntervalValue] = useState('24');
  const [backupScheduleIntervalUnit, setBackupScheduleIntervalUnit] = useState<CornIntervalUnit>('hours');
  const [backupScheduleDiscordWebhookUrl, setBackupScheduleDiscordWebhookUrl] = useState('');
  const [savingBackupSchedule, setSavingBackupSchedule] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState<string | null>(null);
  const [selectedBackupId, setSelectedBackupId] = useState<string>('');
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  

  useEffect(() => {
    keysApi.getAll().then(setKeys).catch(() => setKeys([]));
    keysApi.getKeySettings()
      .then((settings) => {
        setMaxLicenseGen(String(settings.maxKeysPerGeneration));
        setMaxHwidReset(String(settings.hwidResetLimit));
        setHwidResetPeriod(settings.hwidResetPeriod);
      })
      .catch(() => {
        // Keep UI defaults if backend key settings call fails.
      });
    keysApi.getMaintenanceSettings()
      .then((settings) => {
        setMaintenanceMode(settings.maintenanceMode);
        setMaintenanceMsg(settings.maintenanceMessage);
      })
      .catch(() => {
        // Keep UI defaults if backend maintenance settings call fails.
      });
    keysApi.getCornSettings()
      .then((settings) => {
        setCornEnabled(settings.enabled);
        setCornIntervalValue(String(settings.intervalValue));
        setCornIntervalUnit(settings.intervalUnit);
        setCleanupRange(settings.cleanupRange);
      })
      .catch(() => {
        // Keep UI defaults if backend corn settings call fails.
      });
    setBackupsLoading(true);
    keysApi.listBackups()
      .then(setBackups)
      .catch(() => setBackups([]))
      .finally(() => setBackupsLoading(false));
    keysApi.getBackupSchedule()
      .then((s) => {
        setBackupScheduleEnabled(s.enabled);
        setBackupScheduleIntervalValue(String(s.intervalValue));
        setBackupScheduleIntervalUnit(s.intervalUnit);
        setBackupScheduleDiscordWebhookUrl(s.discordWebhookUrl ?? '');
      })
      .catch(() => {});
  }, []);

  const loadBackups = () => {
    setBackupsLoading(true);
    keysApi.listBackups()
      .then(setBackups)
      .catch(() => setBackups([]))
      .finally(() => setBackupsLoading(false));
  };

  const saveBackupSchedule = async (next: Partial<BackupScheduleSettings>) => {
    const value = next.intervalValue ?? (Number(backupScheduleIntervalValue) || 24);
    const unit = next.intervalUnit ?? backupScheduleIntervalUnit;
    const enabled = next.enabled ?? backupScheduleEnabled;
    const discordWebhookUrl = next.discordWebhookUrl ?? backupScheduleDiscordWebhookUrl;
    setSavingBackupSchedule(true);
    try {
      await keysApi.updateBackupSchedule({ enabled, intervalValue: value, intervalUnit: unit, discordWebhookUrl });
      setBackupScheduleEnabled(enabled);
      setBackupScheduleIntervalValue(String(value));
      setBackupScheduleIntervalUnit(unit);
      setBackupScheduleDiscordWebhookUrl(discordWebhookUrl);
      toast.success('Backup schedule saved', 'Saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingBackupSchedule(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!backupId) return;
    setDeletingBackupId(backupId);
    try {
      await keysApi.deleteBackup(backupId);
      toast.success('Backup deleted', 'Deleted');
      setSelectedBackupId('');
      setDeleteConfirm(null);
      loadBackups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingBackupId(null);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    setDownloadingBackupId(backupId);
    try {
      const raw = await keysApi.downloadBackup(backupId);
      if (!raw.startsWith('BASE64ZIP:')) {
        toast.error(raw || 'Download failed');
        return;
      }
      const b64 = raw.slice('BASE64ZIP:'.length);
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${backupId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started', 'Downloading');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloadingBackupId(null);
    }
  };

  const expiredKeys = keys.filter(k => k.status === 'expired');

  const handleSaveKeySettings = async () => {
    const maxKeys = Number.parseInt(maxLicenseGen, 10);
    const resetLimit = Number.parseInt(maxHwidReset, 10);
    if (!Number.isFinite(maxKeys) || maxKeys < 1) {
      toast.error('Max keys per generation must be at least 1');
      return;
    }
    if (!Number.isFinite(resetLimit) || resetLimit < 1) {
      toast.error('Max HWID reset must be at least 1');
      return;
    }

    setSavingKeySettings(true);
    try {
      await keysApi.updateKeySettings({
        maxKeysPerGeneration: maxKeys,
        hwidResetLimit: resetLimit,
        hwidResetPeriod,
      });
      toast.success('Key settings updated', 'Saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update key settings';
      toast.error(message);
    } finally {
      setSavingKeySettings(false);
    }
  };

  const handleMaintenanceToggle = async (nextMode: boolean) => {
    const previousMode = maintenanceMode;
    setMaintenanceMode(nextMode);
    setSavingMaintenance(true);
    try {
      await keysApi.updateMaintenanceSettings({
        maintenanceMode: nextMode,
        maintenanceMessage: maintenanceMsg.trim(),
      });
      toast.success(`Maintenance ${nextMode ? 'enabled' : 'disabled'}`, nextMode ? 'Maintenance on' : 'Maintenance off');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update maintenance settings';
      toast.error(message);
      setMaintenanceMode(previousMode);
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleMaintenanceMessageBlur = async () => {
    setSavingMaintenance(true);
    try {
      await keysApi.updateMaintenanceSettings({
        maintenanceMode,
        maintenanceMessage: maintenanceMsg.trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update maintenance message';
      toast.error(message);
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleCleanupExpired = async () => {
    setCleaningUp(true);
    try {
      const response = await keysApi.deleteExpiredLicensesByAge(cleanupRange);
      toast.success(response || 'Expired licenses deleted', 'Cleanup done');
      const latest = await keysApi.getAll();
      setKeys(latest);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cleanup expired licenses';
      toast.error(message);
    } finally {
      setCleaningUp(false);
    }
  };

  const handleCornToggle = async (nextEnabled: boolean) => {
    const previousEnabled = cornEnabled;
    setCornEnabled(nextEnabled);
    const interval = Number.parseInt(cornIntervalValue, 10);
    if (!Number.isFinite(interval) || interval < 1) {
      toast.error('Auto cleanup interval must be at least 1');
      setCornEnabled(previousEnabled);
      return;
    }

    setSavingCornSettings(true);
    try {
      await keysApi.updateCornSettings({
        enabled: nextEnabled,
        intervalValue: interval,
        intervalUnit: cornIntervalUnit,
        cleanupRange,
      });
      toast.success(`Auto cleanup ${nextEnabled ? 'enabled' : 'disabled'}`, nextEnabled ? 'Cleanup on' : 'Cleanup off');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update auto cleanup settings';
      toast.error(message);
      setCornEnabled(previousEnabled);
    } finally {
      setSavingCornSettings(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-[11px] text-muted-foreground">Configure limits, maintenance & cleanup</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Key Settings */}
        <div className="glass-card p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xs font-semibold flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              Key Settings
            </h3>
            <Button size="sm" className="rounded-xl h-7 px-3 text-xs" onClick={handleSaveKeySettings} disabled={savingKeySettings}>
              {savingKeySettings ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <div className="flex items-end gap-3 flex-wrap md:flex-nowrap">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Max Keys Per Generation</label>
              <Input type="number" min={1} value={maxLicenseGen} onChange={e => setMaxLicenseGen(e.target.value)} className="h-8 text-xs w-24" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Max HWID Reset</label>
              <Input type="number" min={1} value={maxHwidReset} onChange={e => setMaxHwidReset(e.target.value)} className="h-8 text-xs w-24" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">HWID Reset Period (only HWID)</label>
              <Select value={hwidResetPeriod} onValueChange={v => setHwidResetPeriod(v as HwidResetPeriod)}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Per Day</SelectItem>
                  <SelectItem value="week">Per Week</SelectItem>
                  <SelectItem value="month">Per Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="glass-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xs font-semibold flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-primary" />
              Maintenance Mode
            </h3>
            {savingMaintenance && <span className="text-[10px] text-muted-foreground">Saving...</span>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={maintenanceMsg}
                onChange={e => setMaintenanceMsg(e.target.value)}
                onBlur={handleMaintenanceMessageBlur}
                placeholder="Message to users..."
                className="h-8 text-xs flex-1"
                disabled={savingMaintenance}
              />
              <Switch checked={maintenanceMode} onCheckedChange={handleMaintenanceToggle} disabled={savingMaintenance} />
            </div>
            {maintenanceMode && (
              <div className="bg-destructive/10 rounded-lg px-3 py-1.5">
                <p className="text-[11px] text-destructive font-medium">⚠ {maintenanceMsg}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cleanup */}
        <div className="glass-card p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-2">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
            Cleanup
          </h3>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">Expired Keys: <span className="font-semibold text-destructive">{expiredKeys.length}</span></p>
            <div className="flex items-center gap-2">
              <Select value={cleanupRange} onValueChange={(v) => setCleanupRange(v as CleanupAgeRange)}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15d">15 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                  <SelectItem value="1m">1 Month</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="destructive" className="rounded-xl h-8 px-3 text-xs" onClick={handleCleanupExpired} disabled={cleaningUp}>
                <Trash2 className="h-3 w-3 mr-1" /> {cleaningUp ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Deletes only licenses expired before selected age (example: 15 days old expired keys).
          </p>
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">Auto Cleanup (Cron)</p>
            <span className="text-[10px] text-muted-foreground">Every</span>
            <Input type="number" min={1} value={cornIntervalValue} onChange={e => setCornIntervalValue(e.target.value)} className="h-8 text-xs w-16" />
            <Select value={cornIntervalUnit} onValueChange={(v) => setCornIntervalUnit(v as CornIntervalUnit)}>
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            {savingCornSettings && <span className="text-[10px] text-muted-foreground">Saving...</span>}
            <Switch checked={cornEnabled} onCheckedChange={handleCornToggle} disabled={savingCornSettings} />
          </div>
        </div>

        {/* Backup & Export */}
        <div className="glass-card p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-2">
            <Download className="h-3.5 w-3.5 text-primary" />
            Backup & Export
          </h3>
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs" onClick={() => {
              const csvHeader = 'Key,Status,Duration,Created,Expires\n';
              const csvRows = keys.map(k => `${k.key},${k.status},${getDurationDisplayLabel(k)},${k.createdAt},${k.expiresAt || 'N/A'}`).join('\n');
              const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'license_keys.csv'; a.click();
              URL.revokeObjectURL(url);
              toast.success(`${keys.length} keys exported`, 'Exported');
            }}>
              <Download className="h-3 w-3 mr-1" /> Export CSV
            </Button>
            <Button size="sm" className="rounded-xl h-8 px-3 text-xs" onClick={async () => {
              setBackupCreating(true);
              try {
                const id = await keysApi.createBackup();
                toast.success(`Backup created: ${id}`, 'Backup created');
                loadBackups();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Create backup failed');
              } finally {
                setBackupCreating(false);
              }
            }} disabled={backupCreating}>
              {backupCreating ? 'Creating...' : 'Create Backup'}
            </Button>
          </div>
          <div className="border-t border-border/50 pt-2 space-y-2">
            <p className="text-[10px] text-muted-foreground">Backups</p>
            {backupsLoading ? (
              <p className="text-[10px] text-muted-foreground">Loading...</p>
            ) : backups.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No backups yet.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedBackupId || undefined} onValueChange={setSelectedBackupId}>
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-0 max-w-[200px] rounded-xl">
                    <SelectValue placeholder="Select backup" />
                  </SelectTrigger>
                  <SelectContent>
                    {backups.map((b) => (
                      <SelectItem key={b.name} value={b.name} className="text-xs">
                        {b.name} ({(b.size / 1024).toFixed(1)} KB)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" className="h-8 px-3 text-xs rounded-xl" disabled={!selectedBackupId}>
                      Download / Restore
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={() => selectedBackupId && handleDownloadBackup(selectedBackupId)} disabled={!selectedBackupId || downloadingBackupId === selectedBackupId}>
                      <Download className="h-3.5 w-3.5 mr-2" /> Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => selectedBackupId && setRestoreConfirm({ id: selectedBackupId, name: selectedBackupId })} disabled={!selectedBackupId}>
                      <RotateCcw className="h-3.5 w-3.5 mr-2" /> Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => selectedBackupId && setDeleteConfirm({ id: selectedBackupId, name: selectedBackupId })} disabled={!selectedBackupId || deletingBackupId === selectedBackupId} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">Scheduled Backup</p>
              <span className="text-[10px] text-muted-foreground">Every</span>
              <Input type="number" min={1} value={backupScheduleIntervalValue} onChange={e => setBackupScheduleIntervalValue(e.target.value)} onBlur={() => saveBackupSchedule({ intervalValue: Number(backupScheduleIntervalValue) || 24 })} className="h-8 text-xs w-16" disabled={savingBackupSchedule || backupScheduleEnabled} title={backupScheduleEnabled ? 'Turn off schedule to change' : undefined} />
              <Select value={backupScheduleIntervalUnit} onValueChange={(v) => { setBackupScheduleIntervalUnit(v as CornIntervalUnit); saveBackupSchedule({ intervalUnit: v as CornIntervalUnit }); }} disabled={savingBackupSchedule || backupScheduleEnabled}>
                <SelectTrigger className="h-8 text-xs w-24" title={backupScheduleEnabled ? 'Turn off schedule to change' : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
              {savingBackupSchedule && <span className="text-[10px] text-muted-foreground">Saving...</span>}
              <Switch checked={backupScheduleEnabled} onCheckedChange={(v) => saveBackupSchedule({ enabled: v })} disabled={savingBackupSchedule} />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">Discord webhook</p>
              <Input placeholder="https://discord.com/api/webhooks/..." value={backupScheduleDiscordWebhookUrl} onChange={e => setBackupScheduleDiscordWebhookUrl(e.target.value)} onBlur={() => saveBackupSchedule({ discordWebhookUrl: backupScheduleDiscordWebhookUrl.trim() })} className="h-8 text-xs flex-1 min-w-0 font-mono" disabled={savingBackupSchedule || backupScheduleEnabled} title={backupScheduleEnabled ? 'Turn off schedule to change' : undefined} />
            </div>
            {backupScheduleEnabled && <p className="text-[10px] text-muted-foreground">Turn schedule off to change interval or webhook URL.</p>}
          </div>
        </div>

        {/* Delete backup confirmation dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent className="w-[calc(100%-2.5rem)] max-w-sm border-border/30 rounded-2xl">
            <DialogHeader>
              <DialogTitle>Delete backup</DialogTitle>
              <DialogDescription>
                Delete backup <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)} disabled={!!deletingBackupId}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={() => deleteConfirm && handleDeleteBackup(deleteConfirm.id)} disabled={!!deletingBackupId}>
                {deletingBackupId ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Restore confirmation dialog */}
        <Dialog open={!!restoreConfirm} onOpenChange={(open) => { if (!open) { setRestoreConfirm(null); setRestoreConfirmText(''); } }}>
          <DialogContent className="w-[calc(100%-2.5rem)] max-w-sm border-border/30 rounded-2xl">
            <DialogHeader>
              <DialogTitle>Restore backup</DialogTitle>
              <DialogDescription>
                This will replace current data with backup: <strong>{restoreConfirm?.name}</strong>. Type <strong>RESTORE</strong> below to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Type RESTORE to confirm"
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              className="rounded-xl"
              disabled={restoring}
            />
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRestoreConfirm(null); setRestoreConfirmText(''); }} disabled={restoring}>
                Cancel
              </Button>
              <Button size="sm" onClick={async () => {
                if (!restoreConfirm || restoreConfirmText !== 'RESTORE') return;
                setRestoring(true);
                try {
                  await keysApi.restoreBackup(restoreConfirm.id);
                  toast.success('Restore completed. Reload the page to see updated data.', 'Restored');
                  setRestoreConfirm(null);
                  setRestoreConfirmText('');
                  loadBackups();
                  keysApi.getAll().then(setKeys).catch(() => setKeys([]));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Restore failed');
                } finally {
                  setRestoring(false);
                }
              }} disabled={restoreConfirmText !== 'RESTORE' || restoring}>
                {restoring ? 'Restoring...' : 'Restore'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
