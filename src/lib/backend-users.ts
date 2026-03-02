import type { User, WalletLedgerEntry } from './types';
import { getApiUrl, getAuthTokenKey } from './env';

const toRole = (level: number): User['role'] => (level >= 2 ? 'admin' : 'reseller');

const postBrowserCommand = async (command: string): Promise<string> => {
  const token = localStorage.getItem(getAuthTokenKey());
  if (!token) throw new Error('Missing auth token');

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: {
      'X-BrowserData': command,
      'Auth-Token': token,
    },
  });

  const body = await response.text();
  if (!response.ok || body.startsWith('Error:')) {
    throw new Error(body || 'Request failed');
  }
  return body;
};

export const usersApi = {
  async getUserInfo(): Promise<User> {
    const raw = await postBrowserCommand('GetUserInfo');
    const [username, balanceStr, levelStr, name] = raw.split(';');
    const level = Number(levelStr || '1');
    const balance = Number(balanceStr || '0');
    return {
      id: username || 'self',
      username: username || 'self',
      email: `${username || 'self'}@local`,
      name: name || username || 'User',
      role: toRole(level),
      level,
      balance,
      createdAt: new Date().toISOString(),
    };
  },

  async getAllUsers() {
    const raw = await postBrowserCommand('GetAllUsers');
    const lines = raw.split('\n').map((x) => x.trim()).filter(Boolean);
    return lines.map((line) => {
      const [username, password, role, balanceStr, licensesStr, lastActive, name, assignedTo] = line.split(';');
      return {
        username,
        password: password || '',
        role,
        name: name || username,
        balance: Number(balanceStr || '0'),
        licenses: Number(licensesStr || '0'),
        lastActive: Number(lastActive || '0'),
        assignedTo: assignedTo || '',
      };
    });
  },

  async getAdminUsers() {
    const raw = await postBrowserCommand('FetchAdminUsers');
    const lines = raw.split('\n').map((x) => x.trim()).filter(Boolean);
    return lines.map((line) => {
      const [username, name] = line.split(';');
      return {
        username,
        name: name || username,
      };
    });
  },

  /** Get users assigned to the current admin (for Balance page). */
  async getAssignedUsers(): Promise<Array<{ username: string; name: string; role: string; balance: number; licenses: number }>> {
    const raw = await postBrowserCommand('FetchUsers');
    const lines = raw.split('\n').map((x) => x.trim()).filter(Boolean);
    return lines.map((line) => {
      const [username, name, _assignedTo, balanceStr, licensesStr] = line.split(';');
      return {
        username: username || '',
        name: name || username || '',
        role: 'reseller',
        balance: Number(balanceStr || '0'),
        licenses: Number(licensesStr || '0'),
      };
    });
  },

  async createUser(data: { username: string; password: string; name: string; role: 'admin' | 'reseller' | 'banned'; initialBalance?: number }) {
    const amount = data.initialBalance ?? 0;
    return postBrowserCommand(`CreateUserBrowser;${data.username};${data.password};${data.name};${data.role};${amount}`);
  },

  async editUser(data: {
    targetUsername: string;
    newUsername: string;
    newPassword: string;
    newName: string;
    newRole: 'admin' | 'reseller' | 'banned';
    newBalance: number;
  }) {
    return postBrowserCommand(
      `EditUserBrowser;${data.targetUsername};${data.newUsername};${data.newPassword};${data.newName};${data.newRole};${data.newBalance}`
    );
  },

  async toggleUserBan(username: string, shouldBan: boolean) {
    return postBrowserCommand(`ToggleUserBanBrowser;${username};${shouldBan ? 'ban' : 'unban'}`);
  },

  async changePassword(username: string, newPassword: string) {
    return postBrowserCommand(`ChangePasswordBrowser;${username};${newPassword}`);
  },

  async deleteUser(username: string) {
    return postBrowserCommand(`DeleteUserBrowser;${username}`);
  },

  async updateUserAssignment(username: string, assignedTo: string) {
    const value = assignedTo && assignedTo !== '—' ? assignedTo : 'none';
    return postBrowserCommand(`UpdateUserAssignment;${username};${value}`);
  },

  async getRolePricing() {
    const raw = await postBrowserCommand('GetRolePricingBrowser');
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async rechargeUser(username: string, amount: number) {
    return postBrowserCommand(`RechargeUserBrowser;${username};${amount}`);
  },

  /** Get wallet ledger. For reseller: pass '' as targetUsername. For admin: pass username or 'all'. */
  async getWalletLedger(targetUsername: string, page: number = 1, limit: number = 20): Promise<{ total: number; entries: WalletLedgerEntry[] }> {
    const raw = await postBrowserCommand(`GetWalletLedgerBrowser;${targetUsername};${page};${limit}`);
    const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return { total: 0, entries: [] };
    const total = parseInt(lines[0], 10) || 0;
    const entries: WalletLedgerEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('|');
      if (parts.length >= 6) {
        entries.push({
          timestamp: parseInt(parts[0], 10) || 0,
          username: parts[1] || '',
          type: parts[2] === 'credit' ? 'credit' : 'debit',
          amount: parseInt(parts[3], 10) || 0,
          balanceAfter: parseInt(parts[4], 10) || 0,
          ref: parts[5] || '',
          description: parts.slice(6).join('|').trim(),
        });
      }
    }
    return { total, entries };
  },
};
