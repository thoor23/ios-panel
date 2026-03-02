import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Shield, KeyRound, Cog, UserPlus, CheckCircle2, XCircle, RotateCcw, Ban, Trash2, CreditCard, Lock, CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatRoleForDisplay } from '@/lib/topToast';
import { DataTable, type DataColumn } from '@/components/DataTable';
import { auditApi, type AuditLogEntry } from '@/lib/backend-audit';

type AuditCategory = 'auth' | 'verification' | 'generation' | 'actions' | 'admin';

interface AuditEntry {
  id: string;
  category: AuditCategory;
  action: string;
  description: string;
  user: string;
  role: 'admin' | 'reseller' | 'system';
  targetUser: string;
  targetLicense: string;
  details: string;
  /** Plain text password from details JSON (auth tab only). */
  password: string;
  ip: string;
  userAgent: string;
  success: boolean;
  errorMessage: string;
  status: 'success' | 'failed' | 'warning';
  timestamp: string;
  /** From details JSON (verification tab): deviceModel */
  deviceModel?: string;
  /** Short action label for mobile (e.g. generation: "Generated" instead of "Keys Generated") */
  actionShort?: string;
}

/** Auth-only: short label for Details column (Logged In, Password wrong, etc.). */
function authDetailsLabel(rawDetails: string, action: string, errorMessage?: string): string {
  const reason = (errorMessage ?? '').toLowerCase();
  if (action === 'LOGIN') return 'Logged In';
  if (action === 'LOGOUT') return 'Logged Out';
  if (action === 'SESSION_TIMEOUT') return 'Session Timeout';
  if (action === 'LOGIN_FAILED') {
    if (reason.includes('user does not exist') || reason.includes('user not found')) return 'User Does not Exist';
    if (reason.includes('password') && (reason.includes('not correct') || reason.includes('wrong') || reason.includes('incorrect'))) return 'Password wrong';
    if (reason.includes('invalid credential') || reason.includes('invalid user')) return 'Invalid Credentials';
    if (reason.includes('banned')) return 'User Banned';
    return reason ? reason.slice(0, 50) : 'Login Failed';
  }
  return '—';
}

/** Auth-only: extract plain text password from details JSON. */
function extractPasswordFromDetails(rawDetails: string): string {
  if (!rawDetails?.trim()) return '';
  try {
    const d = JSON.parse(rawDetails) as Record<string, unknown>;
    return typeof d?.password === 'string' ? d.password : '';
  } catch {
    return '';
  }
}

/** Key verification: short detail label for Details column (Key match, Key not found, Key banned, etc.). */
function verificationShortDetail(rawDetails: string, success: boolean, errorMessage?: string): string {
  if (success) return 'Key match';
  const err = (errorMessage ?? '').toLowerCase();
  if (err.includes('key not found') || err.includes('not found')) return 'Key not found';
  if (err.includes('invalid application') || err.includes('invalid key')) return 'Invalid key';
  if (err.includes('banned')) return 'Key banned';
  if (err.includes('hwid does not match')) return 'HWID does not match';
  if (err.includes('device change not allowed')) return 'Device change not allowed';
  if (err.includes('expired')) return 'License expired';
  if (err.includes('login cooldown') || err.includes('cooldown')) return 'Login cooldown';
  if (err.includes('data has changed') || err.includes('disconnected')) return 'Data changed';
  if (err.includes('some fields are empty') || err.includes('fatal request')) return 'Invalid request';
  if (err.includes('game not found')) return 'Game not found';
  if (err.includes('login error')) return 'Login error';
  return errorMessage ? errorMessage.replace(/^Error:\s*/i, '').slice(0, 40) : 'Key rejected';
}

/** Key verification: get requestType from details JSON (VerifyKey / ReverifyKey). */
function getVerificationRequestType(rawDetails: string): 'VerifyKey' | 'ReverifyKey' {
  if (!rawDetails?.trim()) return 'VerifyKey';
  try {
    const d = JSON.parse(rawDetails) as Record<string, unknown>;
    const rt = d.requestType as string;
    return rt === 'ReverifyKey' ? 'ReverifyKey' : 'VerifyKey';
  } catch {
    return 'VerifyKey';
  }
}

/** Key verification: get deviceModel from details JSON. */
function getVerificationDeviceModel(rawDetails: string): string {
  if (!rawDetails?.trim()) return '';
  try {
    const d = JSON.parse(rawDetails) as Record<string, unknown>;
    return (d.deviceModel as string) ?? '';
  } catch {
    return '';
  }
}

/** Key generation: short action label for mobile (Generated, Extended, etc.). */
function generationActionShort(actionLabel: string): string {
  const m: Record<string, string> = {
    'Keys Generated': 'Generated',
    'Key Extended': 'Extended',
    'All Keys Extended': 'Extended',
    'Expiry Set': 'Expiry',
  };
  return m[actionLabel] ?? actionLabel;
}

/** Key generation: short detail (Keys generated, Generation failed, Extended, etc.). */
function generationShortDetail(rawDetails: string, action: string, errorMessage?: string): string {
  if (!rawDetails?.trim()) return errorMessage ? 'Failed' : '—';
  try {
    const d = JSON.parse(rawDetails) as Record<string, unknown>;
    if (action === 'KEY_GENERATE') {
      const err = d.error as string;
      if (err) return 'Generation failed';
      const generated = d.generatedCount as number;
      const product = (d.product as string) || 'app';
      const duration = d.duration as string;
      if (typeof generated === 'number' && generated > 0) return `${generated} key(s) for ${product}${duration ? `, ${duration}` : ''}`;
      return `Keys generated for ${product}`;
    }
    if (action === 'KEY_EXTEND') return 'Key extended';
    if (action === 'KEY_EXTEND_ALL') return 'All keys extended';
    if (action === 'KEY_EXPIRY_SET') return 'Expiry set';
    return 'Keys generated';
  } catch {
    return errorMessage ? 'Failed' : '—';
  }
}

/** Key actions: short detail (Key banned, Key unbanned, HWID reset, etc.). */
function keyActionsShortDetail(rawDetails: string, action: string): string {
  if (action === 'BAN_LICENSE') return 'Key banned';
  if (action === 'UNBAN_LICENSE') return 'Key unbanned';
  if (action === 'DELETE_LICENSE') return 'Key deleted';
  if (action === 'HWID_RESET') return 'HWID reset';
  if (action === 'LICENSE_CLEANUP') return 'Cleanup done';
  return '—';
}

/** Admin actions: short detail (User created, Balance recharged, etc.). */
function adminShortDetail(rawDetails: string, action: string): string {
  if (!rawDetails?.trim() && !action) return '—';
  if (action === 'USER_CREATE') return 'User created';
  if (action === 'USER_EDIT') return 'User updated';
  if (action === 'USER_DELETE') return 'User deleted';
  if (action === 'USER_RECHARGE') return 'Balance recharged';
  if (action === 'USER_ROLE_CHANGE') return 'Role changed';
  if (action === 'PASSWORD_CHANGE') return 'Password changed';
  if (action === 'AUDIT_CLEAR') return 'Audit cleared';
  return '—';
}

/** Admin tab Details column: label + value (Credit +500, New password, New role, etc.). */
function adminDetailsLabel(rawDetails: string, action: string): string {
  if (!rawDetails?.trim()) {
    if (action === 'AUDIT_CLEAR') return 'Audit cleared';
    return '—';
  }
  try {
    const d = JSON.parse(rawDetails) as Record<string, unknown>;
    const amt = typeof d.amount === 'number' ? d.amount : typeof d.amount === 'string' ? Number(d.amount) : NaN;
    const role = (v: unknown) => (typeof v === 'string' ? formatRoleForDisplay(v) : String(v ?? '—'));

    if (action === 'USER_RECHARGE') {
      if (!Number.isNaN(amt) && amt !== 0) return amt > 0 ? `Credit +${amt}` : `Debit ${amt}`;
      return `Amount: ${d.amount ?? '—'}`;
    }
    if (action === 'PASSWORD_CHANGE') {
      const p = d.newPassword as string;
      return p != null && p !== '' ? `New password: ${p}` : 'Password changed';
    }
    if (action === 'USER_ROLE_CHANGE') {
      const newRole = d.newRole as string;
      return newRole != null ? `New role: ${role(newRole)}` : 'Role changed';
    }
    if (action === 'USER_CREATE') {
      const parts: string[] = [];
      if (d.role != null) parts.push(`Role: ${role(d.role)}`);
      else if (d.initialLevel != null) parts.push(`Role: ${Number(d.initialLevel) === 2 ? 'Admin' : 'Reseller'}`);
      if (d.initialBalance != null) parts.push(`Balance: ${d.initialBalance}`);
      return parts.length ? parts.join(', ') : 'User created';
    }
    if (action === 'USER_EDIT') {
      const parts: string[] = [];
      if (d.newName != null && String(d.newName).trim() !== '') parts.push(`New name: ${String(d.newName)}`);
      if (d.newPassword != null && String(d.newPassword) !== '') parts.push(`New password: ${String(d.newPassword)}`);
      let delta = typeof d.balanceDelta === 'number' ? d.balanceDelta : typeof d.balanceDelta === 'string' ? Number(d.balanceDelta) : NaN;
      if (Number.isNaN(delta) && typeof d.newBalance === 'number' && typeof d.previousBalance === 'number') delta = d.newBalance - d.previousBalance;
      if (!Number.isNaN(delta) && delta !== 0) parts.push(delta > 0 ? `New balance: Credit +${delta}` : `New balance: Debit ${delta}`);
      return parts.length ? parts.join(', ') : 'User updated';
    }
    if (action === 'USER_DELETE') {
      const parts: string[] = [];
      if (d.deletedRole != null) parts.push(`Deleted role: ${role(d.deletedRole)}`);
      if (d.deletedBalance != null) parts.push(`Balance: ${d.deletedBalance}`);
      return parts.length ? parts.join(', ') : 'User deleted';
    }
    if (action === 'AUDIT_CLEAR') return 'Audit cleared';
    return adminShortDetail(rawDetails, action);
  } catch {
    return adminShortDetail(rawDetails, action);
  }
}

/** Backend actionFilter for each tab */
const categoryToFilter: Record<AuditCategory, string> = {
  auth: 'auth',
  verification: 'key_verification',
  generation: 'key_generation',
  actions: 'key_actions',
  admin: 'actions',
};

/** Phrase details JSON into human-readable text (never include password) */
function phraseDetails(rawDetails: string, action: string, errorMessage?: string): string {
  if (!rawDetails?.trim()) return errorMessage || (action === 'LOGIN_FAILED' ? 'Login failed' : '');
  try {
    const d = JSON.parse(rawDetails) as Record<string, unknown>;
    if (typeof d !== 'object' || d === null) return rawDetails.slice(0, 120);

    // ——— Auth ———
    if (d.loginMethod === 'password' && action !== 'LOGIN_FAILED') return 'Logged in with password';
    if (d.logoutMethod === 'manual') return 'Logged out manually';
    if (action === 'LOGIN_FAILED' && (d.reason || errorMessage)) return `Login failed: ${(d.reason as string) || errorMessage || 'Unknown'}`;

    // ——— Key verification (KEY_LOGIN / KEY_LOGIN_FAILED) ———
    if (action === 'KEY_LOGIN' || action === 'KEY_LOGIN_FAILED') {
      const app = (d.application as string) || (d.keyType as string) || '';
      const pkg = (d.bundleId as string) || (d.packageName as string) || '';
      const err = (d.error as string) || errorMessage;
      if (err) return `Key rejected: ${err}`;
      if (app || pkg) return `Key verified for ${app ? `${app}` : 'app'}${pkg ? ` (${pkg})` : ''}`;
      return 'Key verified';
    }

    // ——— Key generation ———
    if (action === 'KEY_GENERATE') {
      const product = d.product as string;
      const duration = d.duration as string;
      const err = d.error as string;
      if (err) return `Failed: ${err}`;
      const requested = d.requestedCount as number;
      const generated = d.generatedCount as number;
      const key = d.key as string;
      const customText = d.customText as string;
      if (key) return `Generated 1 key for ${product || 'product'}${duration ? `, ${duration}` : ''}${customText ? ` — ${customText}` : ''}`;
      if (typeof requested === 'number' && typeof generated === 'number') return `Generated ${generated} of ${requested} keys for ${product || 'product'}${duration ? `, ${duration}` : ''}`;
      return product || duration ? `${product || ''} ${duration || ''}`.trim() : 'Keys generated';
    }

    // ——— Key extend ———
    if (action === 'KEY_EXTEND') {
      const license = d.license as string;
      const amount = d.amount as number;
      const unit = d.unit as string;
      return `Extended license${license ? ` ${license}` : ''} by ${amount} ${unit || 'days'}`;
    }
    if (action === 'KEY_EXTEND_ALL') {
      const amount = d.amount as number;
      const unit = d.unit as string;
      const count = d.updatedCount as number;
      return `Extended ${count} keys by ${amount} ${unit || 'days'}`;
    }

    // ——— Key actions ———
    if (action === 'BAN_LICENSE') return `Reason: ${(d.reason as string) || 'Banned'}`;
    if (action === 'DELETE_LICENSE') return `Deleted from admin panel${(d.licenseProduct as string) ? ` — ${d.licenseProduct}` : ''}`;
    if (action === 'HWID_RESET') return 'HWID reset';

    // ——— User / admin (optional short phrases) ———
    if (action === 'USER_CREATE') return `User created${(d.role as string) ? ` as ${formatRoleForDisplay(String(d.role))}` : ''}, balance ${d.initialBalance ?? 0}`;
    if (action === 'USER_RECHARGE') return `Recharged ${d.resellerUsername ?? d.targetUsername} by ${d.amount}`;
    if (action === 'USER_EDIT') return `Role/balance updated for ${d.targetUsername}`;
    if (action === 'USER_DELETE') return `Deleted user ${d.targetUsername}`;
    if (action === 'USER_ROLE_CHANGE') return `Role changed to ${formatRoleForDisplay(String(d.newRole))} for ${d.targetUsername}`;
    if (action === 'PASSWORD_CHANGE') return `Password changed for ${d.targetUsername}`;

    // Generic: join key-value, skip password and keys array
    if (d.password !== undefined) delete d.password;
    if (d.keys !== undefined) delete d.keys;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(d)) {
      if (k === 'password' || v === undefined || v === '') continue;
      parts.push(`${k}: ${String(v)}`);
    }
    return parts.length ? parts.join(', ') : (errorMessage || rawDetails.slice(0, 120));
  } catch {
    return errorMessage || rawDetails.slice(0, 120);
  }
}

/** Map backend action to display label */
function actionToLabel(action: string): string {
  const map: Record<string, string> = {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    LOGIN_FAILED: 'Login Failed',
    SESSION_TIMEOUT: 'Session Timeout',
    USER_CREATE: 'User Created',
    USER_EDIT: 'User Edited',
    USER_DELETE: 'User Deleted',
    USER_ROLE_CHANGE: 'Role Changed',
    PASSWORD_CHANGE: 'Password Change',
    USER_RECHARGE: 'Balance Recharged',
    AUDIT_CLEAR: 'Audit Cleared',
    KEY_LOGIN: 'Key Verified',
    KEY_LOGIN_FAILED: 'Key Rejected',
    KEY_GENERATE: 'Keys Generated',
    KEY_EXTEND: 'Key Extended',
    KEY_EXTEND_ALL: 'All Keys Extended',
    KEY_EXPIRY_SET: 'Expiry Set',
    BAN_LICENSE: 'Key Banned',
    UNBAN_LICENSE: 'Key Unbanned',
    DELETE_LICENSE: 'Key Deleted',
    HWID_RESET: 'HWID Reset',
    LICENSE_CLEANUP: 'License Cleanup',
  };
  return map[action] || action.replace(/_/g, ' ');
}

function entryToAuditEntry(e: AuditLogEntry, category: AuditCategory): AuditEntry {
  const isAuth = category === 'auth';
  const isVerification = category === 'verification';
  const isGeneration = category === 'generation';
  const isKeyActions = category === 'actions';
  const isAdmin = category === 'admin';
  const phrased = isAuth
    ? authDetailsLabel(e.details ?? '', e.action, e.errorMessage ?? undefined)
    : isVerification
      ? verificationShortDetail(e.details ?? '', e.success, e.errorMessage ?? undefined)
      : isGeneration
        ? generationShortDetail(e.details ?? '', e.action, e.errorMessage ?? undefined)
        : isKeyActions
          ? keyActionsShortDetail(e.details ?? '', e.action)
          : isAdmin
            ? adminDetailsLabel(e.details ?? '', e.action)
            : phraseDetails(e.details ?? '', e.action, e.errorMessage ?? undefined);
  const description = phrased || e.errorMessage || (e.success ? 'Success' : 'Failed');
  const role = (e.userRole === 'admin' || e.userRole === 'reseller' || e.userRole === 'system' ? e.userRole : 'reseller') as 'admin' | 'reseller' | 'system';
  const actionLabel = isVerification
    ? (getVerificationRequestType(e.details ?? '') === 'ReverifyKey' ? 'Key Reverify' : 'Key Verify')
    : actionToLabel(e.action);
  const deviceModel = isVerification ? getVerificationDeviceModel(e.details ?? '') : undefined;
  const actionShort = isVerification
    ? (actionLabel === 'Key Reverify' ? 'Reverify' : 'Verify')
    : isGeneration
      ? generationActionShort(actionLabel)
      : undefined;
  return {
    id: e.id,
    category,
    action: actionLabel,
    actionShort,
    description: description.slice(0, 300),
    user: e.username,
    role,
    targetUser: e.targetUser ?? '',
    targetLicense: e.targetLicense ?? '',
    details: phrased.slice(0, 200),
    password: isAuth ? extractPasswordFromDetails(e.details ?? '') : '',
    ip: e.ipAddress ?? '',
    userAgent: e.userAgent ?? '',
    success: e.success,
    errorMessage: e.errorMessage ?? '',
    status: e.success ? 'success' : 'failed',
    timestamp: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : new Date().toISOString(),
    deviceModel,
  };
}

const mainTabs: { id: AuditCategory; label: string; icon: React.ElementType }[] = [
  { id: 'auth', label: 'Authentication', icon: Shield },
  { id: 'admin', label: 'Admin Actions', icon: UserPlus },
];

const licenseSubTabs: { id: AuditCategory; label: string; icon: React.ElementType }[] = [
  { id: 'verification', label: 'Key Verification', icon: CheckCircle2 },
  { id: 'generation', label: 'Key Generation', icon: KeyRound },
  { id: 'actions', label: 'Key Actions', icon: Cog },
];

/** All categories in one list for single dropdown */
const allCategoryTabs: { id: AuditCategory; label: string; icon: React.ElementType }[] = [
  { id: 'auth', label: 'Authentication', icon: Shield },
  { id: 'verification', label: 'Key Verification', icon: CheckCircle2 },
  { id: 'generation', label: 'Key Generation', icon: KeyRound },
  { id: 'actions', label: 'Key Actions', icon: Cog },
  { id: 'admin', label: 'Admin Actions', icon: UserPlus },
];

const licenseCategories: AuditCategory[] = ['verification', 'generation', 'actions'];

const statusConfig: Record<string, { dot: string; text: string }> = {
  success: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  failed: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
};

const actionIcons: Record<string, React.ElementType> = {
  'Login': Shield, 'Login Failed': XCircle, 'Logout': Lock, 'Password Change': Lock,
  'HWID Reset': RotateCcw, 'Key Banned': Ban, 'Key Deleted': Trash2, 'Key Verified': CheckCircle2,
  'Key Verify': KeyRound, 'Key Reverify': RotateCcw, 'Key Rejected': XCircle, 'Keys Generated': KeyRound,
  'User Created': UserPlus, 'Balance Recharged': CreditCard, 'User Edited': Cog, 'User Deleted': Trash2,
  'Role Changed': Cog, 'Audit Cleared': Trash2,
};

export default function AdminAuditLog() {
  const [activeTab, setActiveTab] = useState<AuditCategory>('auth');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const itemsPerPage = 15;
  const actionFilter = categoryToFilter[activeTab];
  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '';
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : '';

  const loadLogs = useCallback(() => {
    setLoading(true);
    auditApi
      .getAuditLogs({
        page,
        itemsPerPage,
        actionFilter,
        dateFrom: dateFromStr || undefined,
        dateTo: dateToStr || undefined,
      })
      .then((res) => {
        setEntries(res.entries.map((e) => entryToAuditEntry(e, activeTab)));
        setTotalItems(res.totalItems);
      })
      .catch(() => {
        setEntries([]);
        setTotalItems(0);
      })
      .finally(() => setLoading(false));
  }, [page, actionFilter, dateFromStr, dateToStr, activeTab]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    auditApi.getAuditLogCounts().then((c) => {
      setCounts({
        auth: c.auth_count,
        actions: c.actions_count,
        key_verification: c.key_verification_count,
        key_generation: c.key_generation_count,
        key_actions: c.key_actions_count,
      });
    }).catch(() => {});
  }, [activeTab, entries.length]);

  const handleTabChange = (tab: AuditCategory) => {
    setActiveTab(tab);
    setPage(1);
  };
  const clearDates = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };
  const getActionIcon = (action: string) => actionIcons[action] || Shield;

  const countForTab = (tab: AuditCategory): number => {
    if (tab === 'auth') return counts.auth ?? 0;
    if (tab === 'admin') return counts.actions ?? 0;
    if (tab === 'verification') return counts.key_verification ?? 0;
    if (tab === 'generation') return counts.key_generation ?? 0;
    if (tab === 'actions') return counts.key_actions ?? 0;
    return 0;
  };

  /** Hide target/userAgent/errorMessage on auth; also hide on key verification & key generation */
  const showTargetAndExtra = activeTab !== 'auth' && activeTab !== 'verification' && activeTab !== 'generation';
  /** On Key Actions tab, hide targetUser and userAgent */
  const showTargetUserAndUserAgent = showTargetAndExtra && activeTab !== 'actions';

  const targetUserColumn: DataColumn<AuditEntry>[] =
    showTargetUserAndUserAgent
      ? [
          {
            key: 'targetUser',
            header: 'Target User',
            headerClassName: 'text-left',
            cellClassName: 'text-left text-xs font-mono max-w-[120px] truncate',
            render: (log) => <span title={log.targetUser}>{log.targetUser || '—'}</span>,
          },
        ]
      : [];

  const targetLicenseColumn: DataColumn<AuditEntry>[] =
    activeTab === 'verification' || (showTargetAndExtra && activeTab !== 'admin')
      ? [
          {
            key: 'targetLicense',
            header: 'Key / License',
            headerClassName: 'text-left',
            cellClassName: 'text-left text-xs font-mono max-w-[140px] truncate',
            render: (log) => <span title={log.targetLicense}>{log.targetLicense || '—'}</span>,
          },
        ]
      : [];

  const targetColumns = [...targetUserColumn, ...targetLicenseColumn];

  /** Hide Details column on Key Actions tab */
  const detailsColumn: DataColumn<AuditEntry>[] = activeTab !== 'actions'
    ? [
        {
          key: 'details',
          header: 'Details',
          headerClassName: 'text-left',
          cellClassName: 'text-left text-xs text-muted-foreground max-w-[200px]',
          render: (log) => <span className="block truncate" title={log.details}>{log.details || '—'}</span>,
        },
      ]
    : [];

  /** Hide username & userRole only on key verification; show on auth, key generation, key actions, admin */
  const showUserAndRole = activeTab !== 'verification';

  const errorMessageColumn: DataColumn<AuditEntry>[] = [];

  const userAgentColumn: DataColumn<AuditEntry>[] = [];

  const usernameColumn: DataColumn<AuditEntry>[] = showUserAndRole
    ? [
        {
          key: 'user',
          header: activeTab === 'admin' ? 'Change By' : 'Username',
          headerClassName: 'text-left',
          cellClassName: 'text-left text-xs font-mono max-w-[120px] truncate',
          render: (log) => <span title={log.user}>{log.user || '—'}</span>,
        },
      ]
    : [];

  const userRoleColumn: DataColumn<AuditEntry>[] = showUserAndRole
    ? [
        {
          key: 'role',
          header: 'Role',
          headerClassName: 'text-left',
          cellClassName: 'text-left text-xs',
          render: (log) => (
            <span
              className={cn(
                'inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                log.role === 'admin' ? 'bg-primary/10 text-primary' : log.role === 'reseller' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
              )}
            >
              {formatRoleForDisplay(log.role)}
            </span>
          ),
        },
      ]
    : [];

  const passwordColumn: DataColumn<AuditEntry>[] = activeTab === 'auth'
    ? [
        {
          key: 'password',
          header: 'Password',
          headerClassName: 'text-left',
          cellClassName: 'text-left text-xs font-mono max-w-[120px] truncate',
          render: (log) => <span title={log.password}>{log.password || '—'}</span>,
        },
      ]
    : [];

  /** Verification tab only: Timestamp, Action (Key Verify / Key Reverify), Key, Detail (short), IP, Status */
  const verificationColumns: DataColumn<AuditEntry>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs text-muted-foreground whitespace-nowrap',
      render: (log) => new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
    },
    {
      key: 'action',
      header: 'Action',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs whitespace-nowrap',
      render: (log) => {
        const ActionIcon = getActionIcon(log.action);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="font-medium text-xs truncate">{log.action}</span>
          </div>
        );
      },
      renderMobile: (log) => {
        const ActionIcon = getActionIcon(log.action);
        const label = log.actionShort ?? log.action;
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="font-medium text-xs truncate">{label}</span>
          </div>
        );
      },
    },
    {
      key: 'targetLicense',
      header: 'Key',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs font-mono max-w-[140px] truncate',
      render: (log) => <span title={log.targetLicense}>{log.targetLicense || '—'}</span>,
    },
    {
      key: 'deviceModel',
      header: 'Device Model',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs text-muted-foreground max-w-[100px] truncate',
      render: (log) => <span title={log.deviceModel ?? ''}>{log.deviceModel || '—'}</span>,
    },
    {
      key: 'details',
      header: 'Detail',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs text-muted-foreground max-w-[180px]',
      render: (log) => <span className="block truncate" title={log.details}>{log.details || '—'}</span>,
    },
    {
      key: 'ip',
      header: 'IP',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs font-mono text-muted-foreground',
      render: (log) => log.ip || '—',
    },
    {
      key: 'success',
      header: 'Status',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs',
      render: (log) => {
        const sConfig = statusConfig[log.status];
        return (
          <div className="flex items-center gap-1.5">
            <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', sConfig.dot)} />
            <span className={cn('text-[11px] font-medium', sConfig.text)}>{log.status === 'success' ? 'Success' : 'Failed'}</span>
          </div>
        );
      },
      renderMobile: (log) => {
        const sConfig = statusConfig[log.status];
        return <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', sConfig.dot)} title={log.status === 'success' ? 'Success' : 'Failed'} />;
      },
    },
  ];

  const columns: DataColumn<AuditEntry>[] = activeTab === 'verification' ? verificationColumns : [
    {
      key: 'timestamp',
      header: 'Timestamp',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs text-muted-foreground whitespace-nowrap',
      render: (log) => new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
    },
    {
      key: 'action',
      header: 'Action',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs whitespace-nowrap',
      render: (log) => {
        const ActionIcon = getActionIcon(log.action);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="font-medium text-xs truncate">{log.action}</span>
          </div>
        );
      },
      renderMobile: (log) => {
        const ActionIcon = getActionIcon(log.action);
        const label = log.actionShort ?? log.action;
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="font-medium text-xs truncate">{label}</span>
          </div>
        );
      },
    },
    ...usernameColumn,
    ...userRoleColumn,
    ...passwordColumn,
    ...targetColumns,
    ...detailsColumn,
    {
      key: 'ip',
      header: 'IP',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs font-mono text-muted-foreground',
      render: (log) => log.ip || '—',
    },
    ...userAgentColumn,
    {
      key: 'success',
      header: 'Status',
      headerClassName: 'text-left',
      cellClassName: 'text-left text-xs',
      render: (log) => {
        const sConfig = statusConfig[log.status];
        return (
          <div className="flex items-center gap-1.5">
            <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', sConfig.dot)} />
            <span className={cn('text-[11px] font-medium', sConfig.text)}>{log.status === 'success' ? 'Success' : 'Failed'}</span>
          </div>
        );
      },
      renderMobile: (log) => {
        const sConfig = statusConfig[log.status];
        return <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', sConfig.dot)} title={log.status === 'success' ? 'Success' : 'Failed'} />;
      },
    },
    ...errorMessageColumn,
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-row items-center gap-2 overflow-x-auto py-1 opacity-0 animate-fade-in">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 h-10 px-3 sm:px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 border',
                  'border-border/30 bg-card/60 hover:bg-card/80 text-foreground'
                )}
              >
                {(() => {
                  const current = allCategoryTabs.find((t) => t.id === activeTab);
                  const Icon = current?.icon ?? Shield;
                  return (
                    <>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {current?.label ?? 'Category'}
                      </span>
                      <span className={cn('ml-1 px-1.5 py-0.5 rounded-md text-xs font-bold bg-muted')}>
                        {countForTab(activeTab)}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    </>
                  );
                })()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px] p-1">
              {allCategoryTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const count = countForTab(tab.id);
                return (
                  <DropdownMenuItem
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn('gap-2 text-xs cursor-pointer rounded-md my-0.5 px-3 py-2.5', isActive && 'bg-primary text-primary-foreground font-semibold')}
                  >
                    <tab.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{tab.label}</span>
                    <span className={cn('text-xs font-bold', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{count}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-10 text-xs gap-1.5 rounded-xl border border-border/30 bg-card/60 shrink-0 px-3 font-medium hover:bg-card/80', !dateFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="h-4 w-4 shrink-0" /> {dateFrom ? format(dateFrom, 'dd MMM') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d ?? undefined); setPage(1); }} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground shrink-0">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-10 text-xs gap-1.5 rounded-xl border border-border/30 bg-card/60 shrink-0 px-3 font-medium hover:bg-card/80', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="h-4 w-4 shrink-0" /> {dateTo ? format(dateTo, 'dd MMM') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d ?? undefined); setPage(1); }} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-10 text-xs px-3 text-muted-foreground shrink-0 rounded-xl font-medium" onClick={clearDates}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="opacity-0 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <DataTable
            data={entries}
            columns={columns}
            page={page}
            onPageChange={setPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalItems}
            emptyMessage="No logs found for this category"
            className="glass-card"
            mobileSummaryKeys={activeTab === 'auth' ? ['action', 'user', 'timestamp', 'success'] : activeTab === 'verification' ? ['action', 'targetLicense', 'success'] : activeTab === 'generation' ? ['action', 'user', 'timestamp', 'success'] : activeTab === 'actions' ? ['action', 'targetLicense', 'success'] : ['action', 'details', 'success']}
            loading={loading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
