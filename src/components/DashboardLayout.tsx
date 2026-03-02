import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, ChevronDown, Wallet, CheckCircle2, XCircle, Info, Camera, X, Palette, Layout, Dices } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { BottomTabs } from '@/components/BottomTabs';
import { useTopNotification } from '@/components/TopNotification';
import { useGradientMode } from '@/hooks/useGradientMode';
import { formatRoleForDisplay } from '@/lib/topToast';
import { cn, formatINR } from '@/lib/utils';
import logoImg from '@/assets/logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GradientMode } from '@/hooks/useGradientMode';

const PROFILE_AVATAR_KEY = 'nextios_profile_avatar';
const AVATAR_MAX_SIZE = 128;

function resizeImageToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const r = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        reject(new Error('Failed to resize image'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/keys': 'License Keys',
  '/dashboard/users': 'Users',
  '/dashboard/credits': 'Wallet',
  '/dashboard/manage': 'Management',
  '/dashboard/audit-log': 'Audit Log',
  '/reseller': 'Dashboard',
  '/reseller/keys': 'License Keys',
  '/reseller/credits': 'Wallet',
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { gradientMode, setGradientMode, dashboardProps } = useGradientMode();
  const { notification } = useTopNotification();
  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storageKey = user?.username ? `${PROFILE_AVATAR_KEY}_${user.username}` : null;

  useEffect(() => {
    if (!storageKey) {
      setProfileAvatar(null);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      setProfileAvatar(saved || null);
    } catch {
      setProfileAvatar(null);
    }
  }, [storageKey]);

  const saveAvatar = (dataUrl: string | null) => {
    if (!storageKey) return;
    if (dataUrl) {
      localStorage.setItem(storageKey, dataUrl);
      setProfileAvatar(dataUrl);
    } else {
      localStorage.removeItem(storageKey);
      setProfileAvatar(null);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, AVATAR_MAX_SIZE);
      saveAvatar(dataUrl);
    } catch {
      // ignore
    }
  };

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    saveAvatar(null);
  };

  // Fetch balance from API on mount and when window regains focus (e.g. after key generation)
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);
  useEffect(() => {
    const onFocus = () => refreshUser();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshUser]);

  const notifIcon = notification?.type === 'success' ? CheckCircle2 : notification?.type === 'error' ? XCircle : Info;
  const notifColor = notification?.type === 'success' ? 'text-success' : notification?.type === 'error' ? 'text-destructive' : 'text-primary';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={dashboardProps.className} style={dashboardProps.style}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2 sticky top-2 z-30 bg-background/40 backdrop-blur-2xl rounded-2xl mx-2 sm:mx-4 border border-border/15 shadow-sm">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 sm:flex-1">
          <img src={logoImg} alt="Next iOS" className="h-7 w-7 object-contain brightness-0 dark:brightness-0 dark:invert" />
          <div className="overflow-hidden hidden sm:block">
            {notification ? (
              <div className={cn('flex items-center gap-1.5 animate-fade-in', notifColor)} key={notification.message}>
                {(() => { const NIcon = notifIcon; return <NIcon className="h-3.5 w-3.5 shrink-0" />; })()}
                <span className="text-sm font-semibold tracking-tight leading-tight truncate">{notification.message}</span>
              </div>
            ) : (
              <div>
                <h1 className="text-sm font-semibold tracking-tight leading-tight">{pageTitle}</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Welcome back, {user?.name?.split(' ')[0]} ✌️
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Center: Page title on mobile, Balance on desktop */}
        <div className="flex items-center justify-center">
          {/* Mobile: page title or notification */}
          <div className="sm:hidden overflow-hidden">
            {notification ? (
              <div className={cn('flex items-center gap-1.5 animate-fade-in', notifColor)} key={notification.message}>
                {(() => { const NIcon = notifIcon; return <NIcon className="h-3.5 w-3.5 shrink-0" />; })()}
                <span className="text-sm font-semibold tracking-tight truncate">{notification.message}</span>
              </div>
            ) : (
              <h1 className="text-sm font-semibold tracking-tight">{pageTitle}</h1>
            )}
          </div>
          {/* Desktop: Balance */}
          <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-card border border-border/40 shadow-sm">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold tracking-tight">{formatINR(user?.balance)}</span>
          </div>
        </div>

        {/* Right: Actions + Profile dropdown */}
        <div className="flex items-center gap-1.5 sm:flex-1 justify-end">
          <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 hover:bg-accent/80" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
          </Button>

          {/* Profile dropdown */}
          <DropdownMenu>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'group flex items-center gap-2 ml-1 pl-1 pr-2.5 py-1.5 rounded-full',
                  'hover:bg-accent/70 active:scale-[0.98] transition-all duration-200',
                  'border border-transparent hover:border-border/40'
                )}
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-primary/10 shrink-0 overflow-hidden">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user?.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-48 min-w-[168px] p-0 rounded-xl shadow-lg border border-border/40 bg-card/95 backdrop-blur-xl overflow-hidden"
            >
              {/* Profile header */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2.5 w-full min-w-0">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-lg font-bold text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/10 shrink-0 overflow-hidden">
                      {profileAvatar ? (
                        <img src={profileAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        user?.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                      <span
                        className={cn(
                          'inline-block w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                          user?.role === 'admin'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        )}
                      >
                        {user?.role != null ? formatRoleForDisplay(user.role) : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <Camera className="h-3 w-3" />
                      Change
                    </button>
                    {profileAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/30 shrink-0">
                    <Wallet className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[11px] font-bold text-foreground tabular-nums whitespace-nowrap">{formatINR(user?.balance ?? 0)}</span>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator className="bg-border/50" />

              {/* Theme dropdown */}
              <div className="p-2">
                <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Theme</p>
                <Select value={gradientMode} onValueChange={(v) => setGradientMode(v as GradientMode)}>
                  <SelectTrigger className="h-9 w-full rounded-lg border-border/50 bg-muted/30 text-xs font-medium">
                    <SelectValue>
                      {gradientMode === 'gradient' && (
                        <span className="flex items-center gap-2">
                          <Palette className="h-3.5 w-3.5 shrink-0" />
                          Gradient
                        </span>
                      )}
                      {gradientMode === 'no-gradient' && (
                        <span className="flex items-center gap-2">
                          <Layout className="h-3.5 w-3.5 shrink-0" />
                          No gradient
                        </span>
                      )}
                      {gradientMode === 'random' && (
                        <span className="flex items-center gap-2">
                          <Dices className="h-3.5 w-3.5 shrink-0" />
                          Random
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradient" className="text-xs">
                      <span className="flex items-center gap-2">
                        <Palette className="h-3.5 w-3.5 shrink-0" />
                        Gradient
                      </span>
                    </SelectItem>
                    <SelectItem value="no-gradient" className="text-xs">
                      <span className="flex items-center gap-2">
                        <Layout className="h-3.5 w-3.5 shrink-0" />
                        No gradient
                      </span>
                    </SelectItem>
                    <SelectItem value="random" className="text-xs">
                      <span className="flex items-center gap-2">
                        <Dices className="h-3.5 w-3.5 shrink-0" />
                        Random
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DropdownMenuSeparator className="bg-border/50" />

              {/* Actions */}
              <div className="p-1 pb-1.5">
                <DropdownMenuItem
                  className="cursor-pointer rounded-md px-2.5 py-1.5 gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive focus:outline-none text-xs"
                  onClick={handleLogout}
                >
                  <LogOut className="h-3 w-3 shrink-0" />
                  <span className="font-semibold">Log out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-6 overflow-auto w-full max-w-6xl mx-auto px-3 sm:px-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      <BottomTabs />
    </div>
  );
}
