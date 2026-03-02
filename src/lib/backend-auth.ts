import type { User, UserRole } from './types';
import { getApiUrl, getAuthTokenKey } from './env';

const mapRole = (rawRole: string): UserRole => {
  const normalized = rawRole.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'subadmin') return 'admin';
  return 'reseller';
};

const postBrowserCommand = async (command: string, authToken?: string) => {
  const headers: Record<string, string> = {
    'X-BrowserData': command,
  };

  if (authToken) {
    headers['Auth-Token'] = authToken;
  }

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers,
  });

  const body = await response.text();
  return { response, body };
};

export const authApi = {
  getStoredToken(): string | null {
    return localStorage.getItem(getAuthTokenKey());
  },

  clearStoredToken() {
    localStorage.removeItem(getAuthTokenKey());
  },

  async login(username: string, password: string): Promise<User | null> {
    const loginCommand = `Login;${username};${password}`;
    const { response, body } = await postBrowserCommand(loginCommand);

    if (!response.ok || body.trim() !== 'Login success') {
      return null;
    }

    const token = response.headers.get('auth-token');
    if (!token) {
      return null;
    }

    localStorage.setItem(getAuthTokenKey(), token);

    const roleRes = await postBrowserCommand('FetchUserRole', token);
    const role = mapRole(roleRes.body);

    const infoRes = await postBrowserCommand('GetUserInfo', token);
    const [infoUsername, infoBalance, infoLevel, infoName] = infoRes.body.split(';');
    const parsedLevel = Number(infoLevel || '1');
    const parsedBalance = Number(infoBalance || '0');

    return {
      id: token,
      username: infoUsername || username,
      email: `${infoUsername || username}@local`,
      name: infoName || infoUsername || username,
      role,
      level: Number.isFinite(parsedLevel) ? parsedLevel : 1,
      balance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
      createdAt: new Date().toISOString(),
    };
  },

  async logout() {
    const token = this.getStoredToken();
    if (token) {
      try {
        await postBrowserCommand('LogoutUser', token);
      } catch {
        // ignore network errors on logout cleanup
      }
    }
    this.clearStoredToken();
  },
};
