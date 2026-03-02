export type UserRole = 'admin' | 'reseller';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  level?: number;
  balance?: number;
  avatar?: string;
  createdAt: string;
}

export type KeyStatus = 'active' | 'expired' | 'revoked' | 'unassigned';
export type KeyDuration = 'trial' | '1d' | '7d' | '30d';

export interface LicenseKey {
  id: string;
  key: string;
  product: string;
  status: KeyStatus;
  duration: KeyDuration;
  createdAt: string;
  expiresAt: string | null;
  lastLogin: string | null;
  hwid: string | null;
  brand: string | null;
  model: string | null;
  sdk: number | null;
  createdBy: string;
  resellerName?: string;
  generatedBy: string;
  customerEmail?: string;
  ipAddress?: string | null;
  banBy?: string | null;
  keyTimeSeconds?: number | null;
  durationLabel?: string | null;
}

/** Wallet ledger entry from backend (timestamp, username, type, amount, balanceAfter, ref, description) */
export interface WalletLedgerEntry {
  timestamp: number;
  username: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  ref: string;
  description: string;
}

export const keyPricing: Record<KeyDuration, number> = {
  trial: 0,
  '1d': 3,
  '7d': 5,
  '30d': 10,
};

export const durationLabels: Record<KeyDuration, string> = {
  trial: 'Test',
  '1d': 'Day',
  '7d': 'Week',
  '30d': 'Month',
};

/** Always returns "Test" | "Day" | "Week" | "Month" for display (never "1d"/"7d"). Prefer backend durationLabel when present. */
export function getDurationDisplayLabel(key: { durationLabel?: string | null; duration: KeyDuration }): string {
  const fromBackend = key.durationLabel?.trim();
  if (fromBackend === 'Test' || fromBackend === 'Day' || fromBackend === 'Week' || fromBackend === 'Month') return fromBackend;
  return durationLabels[key.duration] ?? 'Month';
}
