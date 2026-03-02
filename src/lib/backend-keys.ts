import type { KeyDuration, KeyStatus, LicenseKey } from './types';
import { getApiUrl, getAuthTokenKey, getLicenseApp } from './env';

export interface DurationAvailability {
  trial: boolean;
  '1d': boolean;
  '7d': boolean;
  '30d': boolean;
}

export interface RoleDurationAvailability {
  admin: DurationAvailability;
  reseller: DurationAvailability;
}

export interface RolePricingSettings {
  admin: Record<KeyDuration, number>;
  reseller: Record<KeyDuration, number>;
}

export type HwidResetPeriod = 'day' | 'week' | 'month';

export interface KeySettings {
  maxKeysPerGeneration: number;
  hwidResetLimit: number;
  hwidResetPeriod: HwidResetPeriod;
}

export interface MaintenanceSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export type CleanupAgeRange = '15d' | '30d' | '1m';
export type CornIntervalUnit = 'minutes' | 'hours' | 'days' | 'month';

export interface CornSettings {
  enabled: boolean;
  intervalValue: number;
  intervalUnit: CornIntervalUnit;
  cleanupRange: CleanupAgeRange;
}

export interface BackupScheduleSettings {
  enabled: boolean;
  intervalValue: number;
  intervalUnit: CornIntervalUnit;
  discordWebhookUrl?: string;
}

export type CustomLicenseDuration = '30d' | '6m' | '1y' | '2y' | '3y';
export type ExtendUnit = 'hours' | 'day';

const toIso = (epochSeconds: number): string | null => {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return null;
  return new Date(epochSeconds * 1000).toISOString();
};

const mapStatus = (banStatus: string, expiryEpoch: number): KeyStatus => {
  if (expiryEpoch <= 0) return 'unassigned';
  if (banStatus === 'yes') return 'revoked';
  const now = Math.floor(Date.now() / 1000);
  if (expiryEpoch <= now) return 'expired';
  return 'active';
};

const mapDuration = (createdEpoch: number, expiryEpoch: number, keyTimeSeconds?: number | null): KeyDuration => {
  if (expiryEpoch <= 0 || createdEpoch <= 0) {
    if (keyTimeSeconds != null && keyTimeSeconds > 0) {
      if (keyTimeSeconds <= 21600) return 'trial';
      if (keyTimeSeconds <= 86400) return '1d';
      if (keyTimeSeconds <= 604800) return '7d';
      if (keyTimeSeconds >= 2592000) return '30d';
      return '30d';
    }
    return '30d';
  }
  const diff = expiryEpoch - createdEpoch;
  if (diff <= 21600) return 'trial';
  if (diff <= 86400) return '1d';
  if (diff <= 604800) return '7d';
  if (diff >= 2_592_000) return '30d';
  return '30d';
};

const durationToBackend = (duration: KeyDuration): string | null => {
  if (duration === 'trial') return 'Test';
  if (duration === '1d') return 'Day';
  if (duration === '7d') return 'Week';
  if (duration === '30d') return 'Month';
  return null;
};

const parseDurationAvailability = (raw: string): RoleDurationAvailability => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid duration settings response');
  }

  const mapFlatOrRole = (source: unknown): DurationAvailability => {
    const payload = (source && typeof source === 'object' ? source : parsed) as Record<string, unknown>;
    return {
      trial: payload.testEnabled === true,
      '1d': payload.dayEnabled === true,
      '7d': payload.weekEnabled === true,
      '30d': payload.monthEnabled === true,
    };
  };

  const adminSource = parsed.admin;
  const resellerSource = parsed.reseller;

  return {
    admin: mapFlatOrRole(adminSource),
    reseller: mapFlatOrRole(resellerSource),
  };
};

const stringifyDurationAvailability = (settings: RoleDurationAvailability): string =>
  JSON.stringify({
    admin: {
      testEnabled: settings.admin.trial,
      dayEnabled: settings.admin['1d'],
      weekEnabled: settings.admin['7d'],
      monthEnabled: settings.admin['30d'],
    },
    reseller: {
      testEnabled: settings.reseller.trial,
      dayEnabled: settings.reseller['1d'],
      weekEnabled: settings.reseller['7d'],
      monthEnabled: settings.reseller['30d'],
    },
  });

const parseRolePricingSettings = (raw: string): RolePricingSettings => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid role pricing response');
  }

  const mapRole = (role: unknown): Record<KeyDuration, number> => {
    const source = (role && typeof role === 'object') ? (role as Record<string, unknown>) : {};
    return {
      trial: Number(source.nextTest ?? 0),
      '1d': Number(source.nextDay ?? 0),
      '7d': Number(source.nextWeek ?? 0),
      '30d': Number(source.nextMonth ?? 0),
    };
  };

  return {
    admin: mapRole(parsed.admin),
    reseller: mapRole(parsed.reseller),
  };
};

const stringifyRolePricingSettings = (settings: RolePricingSettings): string =>
  JSON.stringify({
    admin: {
      nextTest: settings.admin.trial,
      nextDay: settings.admin['1d'],
      nextWeek: settings.admin['7d'],
      nextMonth: settings.admin['30d'],
    },
    reseller: {
      nextTest: settings.reseller.trial,
      nextDay: settings.reseller['1d'],
      nextWeek: settings.reseller['7d'],
      nextMonth: settings.reseller['30d'],
    },
  });

const parseKeySettings = (raw: string): KeySettings => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid key settings response');
  }

  const periodRaw = String(parsed.hwidResetPeriod ?? 'day');
  const period: HwidResetPeriod =
    periodRaw === 'week' ? 'week' : periodRaw === 'month' ? 'month' : 'day';

  return {
    maxKeysPerGeneration: Math.max(1, Number(parsed.maxKeysPerGeneration ?? 1) || 1),
    hwidResetLimit: Math.max(1, Number(parsed.hwidResetLimit ?? 1) || 1),
    hwidResetPeriod: period,
  };
};

const stringifyKeySettings = (settings: KeySettings): string =>
  JSON.stringify({
    maxKeysPerGeneration: Math.max(1, Number(settings.maxKeysPerGeneration) || 1),
    hwidResetLimit: Math.max(1, Number(settings.hwidResetLimit) || 1),
    hwidResetPeriod: settings.hwidResetPeriod,
  });

const parseMaintenanceSettings = (raw: string): MaintenanceSettings => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid maintenance settings response');
  }

  return {
    maintenanceMode: parsed.maintenanceMode === true,
    maintenanceMessage: String(parsed.maintenanceMessage ?? 'Server is under maintenance. Please try later.'),
  };
};

const stringifyMaintenanceSettings = (settings: MaintenanceSettings): string =>
  // X-BrowserData uses ';' as command delimiter, so sanitize user-provided message.
  JSON.stringify({
    maintenanceMode: settings.maintenanceMode === true,
    maintenanceMessage: String(settings.maintenanceMessage || 'Server is under maintenance. Please try later.')
      .replace(/;/g, ',')
      .replace(/\r?\n/g, ' '),
  });

const parseCornSettings = (raw: string): CornSettings => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid corn settings response');
  }

  const unitRaw = String(parsed.intervalUnit ?? 'hours');
  const intervalUnit: CornIntervalUnit =
    unitRaw === 'days' ? 'days' : unitRaw === 'month' ? 'month' : 'hours';
  const rangeRaw = String(parsed.cleanupRange ?? '30d');
  const cleanupRange: CleanupAgeRange =
    rangeRaw === '15d' ? '15d' : rangeRaw === '1m' ? '1m' : '30d';

  return {
    enabled: parsed.enabled === true,
    intervalValue: Math.max(1, Number(parsed.intervalValue ?? 1) || 1),
    intervalUnit,
    cleanupRange,
  };
};

const stringifyCornSettings = (settings: CornSettings): string =>
  JSON.stringify({
    enabled: settings.enabled === true,
    intervalValue: Math.max(1, Number(settings.intervalValue) || 1),
    intervalUnit: settings.intervalUnit,
    cleanupRange: settings.cleanupRange,
  });

const parseBackupScheduleSettings = (raw: string): BackupScheduleSettings => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid backup schedule response');
  }
  const unitRaw = String(parsed.intervalUnit ?? 'hours');
  const intervalUnit: CornIntervalUnit =
    unitRaw === 'minutes' ? 'minutes' : unitRaw === 'days' ? 'days' : unitRaw === 'month' ? 'month' : 'hours';
  return {
    enabled: parsed.enabled === true,
    intervalValue: Math.max(1, Number(parsed.intervalValue ?? 1) || 1),
    intervalUnit,
    discordWebhookUrl: typeof parsed.discordWebhookUrl === 'string' ? parsed.discordWebhookUrl : undefined,
  };
};

const stringifyBackupScheduleSettings = (settings: BackupScheduleSettings): string =>
  JSON.stringify({
    enabled: settings.enabled === true,
    intervalValue: Math.max(1, Number(settings.intervalValue) || 1),
    intervalUnit: settings.intervalUnit,
    discordWebhookUrl: settings.discordWebhookUrl ?? '',
  });

const postBrowserCommand = async (command: string) => {
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

const parseGetKeyResponse = (raw: string): LicenseKey[] => {
  const lines = raw.split('\n').map((x) => x.trim()).filter(Boolean);
  const dataLines = lines.filter((line) => !line.startsWith('Pagination:'));

  return dataLines.map((line) => {
    const parts = line.split(';');
    const [
      license,
      application,
      banStatus,
      expiryStr,
      createdStr,
      lastLoginStr,
      deviceId,
      brand,
      model,
      iosVersion,
      ipAddress,
      generatedBy,
      banBy,
    ] = parts;
    const keyTimeStr = parts[13];
    const durationLabelStr = parts[14];
    const expiryEpoch = Number(expiryStr || '0');
    const createdEpoch = Number(createdStr || '0');
    const lastLoginEpoch = Number(lastLoginStr || '0');
    const parsedSdk = Number.parseInt(iosVersion || '', 10);
    const keyTimeSeconds = keyTimeStr !== undefined && String(keyTimeStr).trim() !== '' ? Number(keyTimeStr) : null;

    return {
      id: license,
      key: license,
      product: application || 'next',
      status: mapStatus(banStatus || '', expiryEpoch),
      duration: mapDuration(createdEpoch, expiryEpoch, keyTimeSeconds),
      createdAt: toIso(createdEpoch) || new Date().toISOString(),
      expiresAt: toIso(expiryEpoch),
      lastLogin: toIso(lastLoginEpoch),
      hwid: deviceId || null,
      brand: brand || null,
      model: model || null,
      sdk: Number.isFinite(parsedSdk) ? parsedSdk : null,
      createdBy: generatedBy || 'unknown',
      generatedBy: generatedBy || 'unknown',
      ipAddress: ipAddress || null,
      banBy: banBy || null,
      keyTimeSeconds: keyTimeSeconds != null && Number.isFinite(keyTimeSeconds) ? keyTimeSeconds : null,
      durationLabel: (durationLabelStr && String(durationLabelStr).trim()) || null,
    } as LicenseKey;
  });
};

export const keysApi = {
  async getAll(): Promise<LicenseKey[]> {
    const raw = await postBrowserCommand('GetKey;1;200');
    return parseGetKeyResponse(raw);
  },

  async generate(duration: KeyDuration, count: number): Promise<string[]> {
    const backendDuration = durationToBackend(duration);
    if (!backendDuration) {
      throw new Error('Selected duration is not allowed');
    }
    const raw = await postBrowserCommand(`GenerateKeyBrowser;${getLicenseApp()};${backendDuration};${count}`);
    return raw.split(';').map((x) => x.trim()).filter(Boolean);
  },

  async generateCustomLicense(customText: string, duration: CustomLicenseDuration): Promise<string> {
    const safeText = customText.replace(/;/g, '_').trim();
    if (!safeText) {
      throw new Error('Custom text is required');
    }
    const raw = await postBrowserCommand(`GenerateCustomLicenseBrowser;${getLicenseApp()};${safeText};${duration}`);
    return raw.trim();
  },

  async extendSingleKey(license: string, amount: number, unit: ExtendUnit) {
    return postBrowserCommand(`ExtendSingleKeyBrowser;${license};${amount};${unit}`);
  },

  async extendAllKeys(amount: number, unit: ExtendUnit) {
    return postBrowserCommand(`ExtendAllKeysBrowser;${amount};${unit}`);
  },

  async getDurationAvailability(): Promise<RoleDurationAvailability> {
    const raw = await postBrowserCommand('GetDurationAvailability');
    return parseDurationAvailability(raw);
  },

  async updateDurationAvailability(settings: RoleDurationAvailability) {
    return postBrowserCommand(`UpdateDurationAvailability;${stringifyDurationAvailability(settings)}`);
  },

  async getRolePricingSettings(): Promise<RolePricingSettings> {
    const raw = await postBrowserCommand('GetRolePricingBrowser');
    return parseRolePricingSettings(raw);
  },

  async updateRolePricingSettings(settings: RolePricingSettings) {
    return postBrowserCommand(`UpdateRolePricingBrowser;${stringifyRolePricingSettings(settings)}`);
  },

  async getKeySettings(): Promise<KeySettings> {
    const raw = await postBrowserCommand('GetKeySettingsBrowser');
    return parseKeySettings(raw);
  },

  /** Read-only: admin + reseller dono kar sakte. Generate dialog ke liye limit. */
  async getGenerateLimit(): Promise<number> {
    const raw = await postBrowserCommand('GetGenerateLimitBrowser');
    const trimmed = raw.trim();
    if (trimmed.startsWith('Error:')) throw new Error(trimmed.slice(6).trim());
    const num = parseInt(trimmed, 10);
    return Number.isFinite(num) && num >= 1 ? num : 1;
  },

  async updateKeySettings(settings: KeySettings) {
    return postBrowserCommand(`UpdateKeySettingsBrowser;${stringifyKeySettings(settings)}`);
  },

  async getMaintenanceSettings(): Promise<MaintenanceSettings> {
    const raw = await postBrowserCommand('GetMaintenanceSettingsBrowser');
    return parseMaintenanceSettings(raw);
  },

  async updateMaintenanceSettings(settings: MaintenanceSettings) {
    return postBrowserCommand(`UpdateMaintenanceSettingsBrowser;${stringifyMaintenanceSettings(settings)}`);
  },

  async resetHwid(license: string) {
    return postBrowserCommand(`ResetHWIDBrowser;${license}`);
  },

  async banKey(license: string, reason: string) {
    const safeLicense = license.replace(/;/g, '').trim();
    const safeReason = (reason || 'Banned from panel').replace(/;/g, ',').trim();
    return postBrowserCommand(`BanKeyBrowser;${safeLicense};${safeReason}`);
  },

  async unbanKey(license: string) {
    const safeLicense = license.replace(/;/g, '').trim();
    return postBrowserCommand(`UnbanKeyBrowser;${safeLicense}`);
  },

  async deleteKey(license: string) {
    return postBrowserCommand(`DeleteLicenseBrowser;${license}`);
  },

  async deleteExpiredLicensesByAge(range: CleanupAgeRange) {
    return postBrowserCommand(`DeleteExpiredLicensesByAgeBrowser;${range}`);
  },

  async getCornSettings(): Promise<CornSettings> {
    const raw = await postBrowserCommand('GetCornSettingsBrowser');
    return parseCornSettings(raw);
  },

  async updateCornSettings(settings: CornSettings) {
    return postBrowserCommand(`UpdateCornSettingsBrowser;${stringifyCornSettings(settings)}`);
  },

  async createBackup(): Promise<string> {
    const raw = await postBrowserCommand('CreateBackupBrowser');
    return raw.trim();
  },

  async listBackups(): Promise<{ name: string; size: number }[]> {
    const raw = await postBrowserCommand('ListBackupsBrowser');
    try {
      const arr = JSON.parse(raw) as unknown[];
      return (Array.isArray(arr) ? arr : []).map((item: unknown) => {
        const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return { name: String(o.name ?? ''), size: Number(o.size ?? 0) };
      });
    } catch {
      return [];
    }
  },

  async restoreBackup(backupId: string): Promise<void> {
    const safe = backupId.replace(/;/g, '').trim();
    if (!safe) throw new Error('Backup ID required');
    await postBrowserCommand(`RestoreBackupBrowser;${safe}`);
  },

  async getBackupSchedule(): Promise<BackupScheduleSettings> {
    const raw = await postBrowserCommand('GetBackupScheduleBrowser');
    return parseBackupScheduleSettings(raw);
  },

  async updateBackupSchedule(settings: BackupScheduleSettings): Promise<void> {
    await postBrowserCommand(`UpdateBackupScheduleBrowser;${stringifyBackupScheduleSettings(settings)}`);
  },

  async downloadBackup(backupId: string): Promise<string> {
    const safe = backupId.replace(/;/g, '').trim();
    if (!safe) throw new Error('Backup ID required');
    return postBrowserCommand(`DownloadBackupBrowser;${safe}`);
  },

  async deleteBackup(backupId: string): Promise<void> {
    const safe = backupId.replace(/;/g, '').trim();
    if (!safe) throw new Error('Backup ID required');
    await postBrowserCommand(`DeleteBackupBrowser;${safe}`);
  },
};
