import { toast as sonnerToast } from 'sonner';

type NotifyFn = (type: 'success' | 'error' | 'info', message: string) => void;

let _notify: NotifyFn = () => {};
let _isMobile = false;

/** Capitalize role for display: admin → Admin, reseller → Reseller, banned → Banned, system → System */
export function formatRoleForDisplay(role: string): string {
  if (role === 'admin') return 'Admin';
  if (role === 'reseller') return 'Reseller';
  if (role === 'banned') return 'Banned';
  if (role === 'system') return 'System';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function setGlobalNotify(fn: NotifyFn) {
  _notify = fn;
}

export function setGlobalIsMobile(val: boolean) {
  _isMobile = val;
}

function dispatch(type: 'success' | 'error' | 'info', msg: string, mobileMsg?: string) {
  const text = (_isMobile && mobileMsg !== undefined && mobileMsg !== '') ? mobileMsg : msg;
  if (_isMobile) {
    _notify(type, text);
  } else {
    sonnerToast[type](text);
  }
}

export const topToast = {
  /** msg = desktop message; mobileMsg = optional short message for mobile view */
  success: (msg: string, mobileMsg?: string) => dispatch('success', msg, mobileMsg),
  error: (msg: string, mobileMsg?: string) => dispatch('error', msg, mobileMsg),
  info: (msg: string, mobileMsg?: string) => dispatch('info', msg, mobileMsg),
};
