import { authApi } from './backend-auth';
import { getApiUrl } from './env';

type StatsMap = Record<string, number>;

export type DashboardPoint = {
  day: string;
  timestamp: number;
  keys: number;
  active: number;
  online: number;
};

export type AdminOverviewStats = {
  totalKeys: number;
  onlineUsers: number;
  activeUsers24h: number;
  totalUsers: number;
  totalBalance: number;
  totalLicenses: number;
};

const parseSemicolonStats = (raw: string): StatsMap => {
  return raw
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .reduce<StatsMap>((acc, pair) => {
      const [key, value] = pair.split(':');
      if (!key) return acc;
      const parsed = Number(value);
      acc[key.trim()] = Number.isFinite(parsed) ? parsed : 0;
      return acc;
    }, {});
};

const postBrowserCommand = async (command: string): Promise<string> => {
  const token = authApi.getStoredToken();
  if (!token) {
    throw new Error('Missing auth token');
  }

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

export const dashboardApi = {
  async getOverviewStats(role: 'admin' | 'reseller'): Promise<AdminOverviewStats> {
    const dashboardRaw = await postBrowserCommand('GetDashboardStats');
    const adminRaw = role === 'admin' ? await postBrowserCommand('GetAdminStats') : '';

    const dashboard = parseSemicolonStats(dashboardRaw);
    const admin = parseSemicolonStats(adminRaw);

    return {
      totalKeys: dashboard.total_keys ?? 0,
      onlineUsers: dashboard.online_users ?? admin.online_users ?? 0,
      activeUsers24h: dashboard.active_users_24h ?? 0,
      totalUsers: role === 'admin' ? (admin.total_users ?? 0) : 1,
      totalBalance: admin.total_balance ?? 0,
      totalLicenses: admin.total_licenses ?? dashboard.total_keys ?? 0,
    };
  },

  async getAnalytics(hours: number): Promise<DashboardPoint[]> {
    const raw = await postBrowserCommand(`GetAnalytics;${hours}`);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as DashboardPoint[];
    } catch {
      return [];
    }
  },
};
