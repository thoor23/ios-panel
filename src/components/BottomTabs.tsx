import {
  LayoutDashboard, Key, Users, CreditCard, ScrollText, Settings2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const adminItems = [
  { title: 'Home', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Keys', url: '/dashboard/keys', icon: Key },
  { title: 'Users', url: '/dashboard/users', icon: Users },
  { title: 'Wallet', url: '/dashboard/credits', icon: CreditCard },
  { title: 'Manage', url: '/dashboard/manage', icon: Settings2 },
  { title: 'Audit Log', url: '/dashboard/audit-log', icon: ScrollText },
];

const resellerItems = [
  { title: 'Home', url: '/reseller', icon: LayoutDashboard },
  { title: 'Keys', url: '/reseller/keys', icon: Key },
  { title: 'Wallet', url: '/reseller/credits', icon: CreditCard },
];

export function BottomTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const items = user?.role === 'admin' ? adminItems : resellerItems;

  const isActive = (url: string) => {
    if (url === '/dashboard' || url === '/reseller') return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] w-[calc(100vw-2rem)] max-w-md mx-auto px-0 sm:px-1">
      <div className="bottom-dock flex items-center justify-center gap-0.5 sm:gap-1 px-1.5 py-1.5 sm:px-2 sm:py-1.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = isActive(item.url);
          return (
            <button
              key={item.url}
              onClick={() => navigate(item.url)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 shrink-0',
                'min-h-[44px] min-w-[44px] min-[380px]:min-w-0 min-[380px]:px-2 sm:px-3 px-0 py-1.5',
                active
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium leading-tight truncate max-w-[3.5rem] min-[400px]:max-w-[4rem] sm:max-w-none hidden min-[380px]:inline">
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
