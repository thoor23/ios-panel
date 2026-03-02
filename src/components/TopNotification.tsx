import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { setGlobalNotify, setGlobalIsMobile } from '@/lib/topToast';
import { useIsMobile } from '@/hooks/use-mobile';

type NotifType = 'success' | 'error' | 'info';

interface Notification {
  type: NotifType;
  message: string;
}

interface TopNotificationContextType {
  notification: Notification | null;
}

const TopNotificationContext = createContext<TopNotificationContextType>({ notification: null });

export const useTopNotification = () => useContext(TopNotificationContext);

export function TopNotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isMobile = useIsMobile();

  const notify = useCallback((type: NotifType, message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNotification({ type, message });
    timerRef.current = setTimeout(() => setNotification(null), 2500);
  }, []);

  useEffect(() => {
    setGlobalNotify(notify);
  }, [notify]);

  useEffect(() => {
    setGlobalIsMobile(isMobile);
  }, [isMobile]);

  return (
    <TopNotificationContext.Provider value={{ notification }}>
      {children}
    </TopNotificationContext.Provider>
  );
}
