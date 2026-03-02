import { authApi } from './backend-auth';
import { getApiUrl } from './env';

const postBrowserCommand = async (command: string): Promise<string> => {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Missing auth token');
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'X-BrowserData': command, 'Auth-Token': token },
  });
  const body = await response.text();
  if (!response.ok || body.startsWith('Error:')) throw new Error(body || 'Request failed');
  return body;
};

/** Parse one CSV line with quoted fields ("" = escaped quote) */
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      out.push(field);
      if (i < line.length && line[i] === ',') i++;
    } else {
      let field = '';
      while (i < line.length && line[i] !== ',') {
        field += line[i];
        i++;
      }
      out.push(field.trim());
      if (line[i] === ',') i++;
    }
  }
  return out;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  username: string;
  userRole: string;
  targetUser: string;
  targetLicense: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage: string;
}

export interface AuditLogsResponse {
  entries: AuditLogEntry[];
  page: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

export interface AuditLogCounts {
  auth_count: number;
  actions_count: number;
  key_verification_count: number;
  key_generation_count: number;
  key_actions_count: number;
  failed_count: number;
}

export const auditApi = {
  async getAuditLogs(params: {
    page: number;
    itemsPerPage: number;
    actionFilter?: string;
    userFilter?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AuditLogsResponse> {
    const { page = 1, itemsPerPage = 50, actionFilter = '', userFilter = '', dateFrom = '', dateTo = '' } = params;
    const cmd = `GetAuditLogs;${page};${itemsPerPage};${actionFilter};${userFilter};${dateFrom};${dateTo}`;
    const raw = await postBrowserCommand(cmd);
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const paginationLine = lines.find((l) => l.startsWith('Pagination:'));
    const dataLines = paginationLine ? lines.slice(0, lines.indexOf(paginationLine)) : lines;

    const entries: AuditLogEntry[] = [];
    for (const line of dataLines) {
      const rawFields = parseCSVLine(line);
      const fields = rawFields.map((f) => f.trim());
      if (fields.length < 12) continue;
      entries.push({
        id: fields[0] ?? '',
        timestamp: Number(fields[1]) || 0,
        action: fields[2] ?? '',
        username: fields[3] ?? '',
        userRole: fields[4] ?? '',
        targetUser: fields[5] ?? '',
        targetLicense: fields[6] ?? '',
        details: fields[7] ?? '',
        ipAddress: fields[8] ?? '',
        userAgent: fields[9] ?? '',
        success: (fields[10] ?? '').toLowerCase() === 'true',
        errorMessage: fields[11] ?? '',
      });
    }

    let pageNum = 1;
    let itemsPerPageNum = 50;
    let totalItems = 0;
    let totalPages = 0;
    if (paginationLine) {
      const pageM = paginationLine.match(/page=(\d+)/);
      const ppM = paginationLine.match(/items_per_page=(\d+)/);
      const tiM = paginationLine.match(/total_items=(\d+)/);
      const tpM = paginationLine.match(/total_pages=(\d+)/);
      if (pageM) pageNum = parseInt(pageM[1], 10);
      if (ppM) itemsPerPageNum = parseInt(ppM[1], 10);
      if (tiM) totalItems = parseInt(tiM[1], 10);
      if (tpM) totalPages = parseInt(tpM[1], 10);
    }

    return {
      entries,
      page: pageNum,
      itemsPerPage: itemsPerPageNum,
      totalItems,
      totalPages,
    };
  },

  async getAuditLogCounts(): Promise<AuditLogCounts> {
    const raw = await postBrowserCommand('GetAuditLogCounts');
    const counts: AuditLogCounts = {
      auth_count: 0,
      actions_count: 0,
      key_verification_count: 0,
      key_generation_count: 0,
      key_actions_count: 0,
      failed_count: 0,
    };
    const pairs = raw.split(',');
    for (const p of pairs) {
      const [key, val] = p.split('=').map((s) => s.trim());
      if (key && val !== undefined && key in counts) {
        (counts as Record<string, number>)[key] = parseInt(val, 10) || 0;
      }
    }
    return counts;
  },
};
