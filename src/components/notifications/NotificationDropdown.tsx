"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { Menu, Transition } from "@headlessui/react";
import { 
  Bell, 
  X, 
  CheckCheck, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Clock
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Exported helper functions to maintain compatibility with other components
export const getNotificationTarget = (
  type: string,
  title: string,
  message: string,
  role?: string
): string => {
  const t = `${title} ${message}`.toLowerCase();
  const isAdmin = role === 'ADMIN' || role === 'MANAGER' || role === 'FOREMAN' || role === 'ASSISTANT_FOREMAN';
  if (t.includes('cuti') || t.includes('permohonan cuti')) {
    return isAdmin ? '/leave' : '/leave';
  }
  if (t.includes('lembur') || t.includes('overtime')) {
    return isAdmin ? '/approvals/overtime' : '/attendance';
  }
  if (t.includes('check-in') || t.includes('check-out') || t.includes('absen')) {
    return '/attendance';
  }
  if (t.includes('gaji') || t.includes('payroll') || t.includes('slip gaji')) {
    return '/payroll';
  }
  if (t.includes('kasbon') || t.includes('advance') || t.includes('pinjaman lunak') || t.includes('soft loan')) {
    return t.includes('soft loan') ? '/soft-loan' : '/advance';
  }
  return '/notifications';
};

export const getNotificationHref = (
  type: string,
  title: string,
  message: string,
  role?: string
): string => {
  const m = message || '';
  const match = m.match(/\[#ref:([A-Z_]+):([a-zA-Z0-9_-]+)\]$/);
  if (match) {
    const refType = match[1];
    const refId = match[2];
    if (refType === 'LEAVE') return `/leave?selectedId=${refId}`;
    if (refType === 'OVERTIME') return `/approvals/overtime?requestId=${refId}`;
    if (refType === 'ATTENDANCE') return `/attendance?attendanceId=${refId}`;
    if (refType === 'PAYROLL') return `/payroll?payrollId=${refId}`;
    if (refType === 'ADVANCE') return `/advance?id=${refId}`;
    if (refType === 'SOFT_LOAN') return `/soft-loan?loanId=${refId}`;
  }
  return getNotificationTarget(type, title, message, role);
};

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  refType?: string;
  refId?: string;
};

export const NOTIFICATION_UPDATE_EVENT = 'notification-update';

function MenuOpenSync({ open, onChange }: { open: boolean; onChange: (open: boolean) => void }) {
  useEffect(() => { onChange(open) }, [open, onChange]);
  return null;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Baru saja';
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} hari lalu`;

  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date);
};

const hrefFromRef = (notification: Notification, role?: string) => {
  const { refType, refId, type, title, message } = notification;
  if (refType && refId) {
    if (refType === 'LEAVE') return `/leave?selectedId=${refId}`;
    if (refType === 'OVERTIME') return `/approvals/overtime?requestId=${refId}`;
    if (refType === 'ATTENDANCE') return `/attendance?attendanceId=${refId}`;
    if (refType === 'PAYROLL') return `/payroll?payrollId=${refId}`;
    if (refType === 'ADVANCE') return `/advance?id=${refId}`;
    if (refType === 'SOFT_LOAN') return `/soft-loan?loanId=${refId}`;
  }
  return getNotificationHref(type, title, message, role);
};

const getIcon = (type: string) => {
  switch (type) {
    case 'info': return <Info className="w-5 h-5 text-blue-600" />;
    case 'success': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    case 'error': return <AlertCircle className="w-5 h-5 text-red-600" />;
    default: return <Bell className="w-5 h-5 text-indigo-600" />;
  }
};

const getBgColor = (type: string) => {
  switch (type) {
    case 'info': return 'bg-blue-50';
    case 'success': return 'bg-green-50';
    case 'warning': return 'bg-amber-50';
    case 'error': return 'bg-red-50';
    default: return 'bg-indigo-50';
  }
};

export default function NotificationDropdown() {
  const { data: session } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const POLLING_INTERVAL = 30000;
  const [fetchError, setFetchError] = useState<boolean>(false);

  // API Status Check
  const checkApiStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch("/api/health", {
        method: "HEAD",
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn("API server unavailable:", error);
      return false;
    }
  }, []);

  // Offline/Cache Handling
  const getOfflineNotifications = useCallback(() => {
    try {
      const cachedNotifications = localStorage.getItem('cached_notifications');
      if (cachedNotifications) return JSON.parse(cachedNotifications);
    } catch (error) {
      console.error("Error reading cache:", error);
    }
    return { notifications: [], unreadCount: 0 };
  }, []);

  const cacheNotifications = useCallback((data: { notifications: Notification[], unreadCount: number }) => {
    try {
      localStorage.setItem('cached_notifications', JSON.stringify(data));
      const unreadIds = (data.notifications || []).filter(n => !n.read).map(n => n.id);
      localStorage.setItem('unread_notifications', JSON.stringify(unreadIds));
    } catch (error) {
      console.error("Error caching:", error);
    }
  }, []);

  // Fetch Logic
  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!session) return;
    
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    const fetchWithRetry = async () => {
      try {
        setFetchError(false);
        if (showLoading) setIsLoading(true);
        else setIsRefreshing(true);

        if (retryCount > 0) {
          const apiAvailable = await checkApiStatus();
          if (!apiAvailable) throw new Error("API server not available");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch("/api/notifications?limit=5&timestamp=" + Date.now(), {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (data.hasError) setFetchError(true);
        
        const processedData = {
          notifications: data.notifications || [],
          unreadCount: data.unreadCount || 0
        };
        
        cacheNotifications(processedData);
        setNotifications(processedData.notifications);
        setUnreadCount(processedData.unreadCount);
        lastFetchTimeRef.current = Date.now();
      } catch (error: any) {
        setFetchError(true);
        const cachedData = getOfflineNotifications();
        setNotifications(cachedData.notifications || []);
        setUnreadCount(cachedData.unreadCount || 0);

        if (error instanceof TypeError && error.message === 'Failed to fetch' && retryCount < MAX_RETRIES) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return fetchWithRetry();
        }
      } finally {
        if (showLoading) setIsLoading(false);
        else setIsRefreshing(false);
      }
    };

    await fetchWithRetry();
  }, [session, checkApiStatus, getOfflineNotifications, cacheNotifications]);

  const checkForNewNotifications = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current > POLLING_INTERVAL) {
      fetchNotifications(false);
    }
  }, [fetchNotifications]);

  // Effects
  useEffect(() => {
    if (session) {
      fetchNotifications().catch(console.error);
      lastFetchTimeRef.current = Date.now();
      
      pollingIntervalRef.current = setInterval(() => {
        if (!fetchError) {
          fetchNotifications(false).catch(err => {
            console.error("Polling error:", err);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              setTimeout(() => {
                if (session) {
                  pollingIntervalRef.current = setInterval(() => fetchNotifications(false), POLLING_INTERVAL);
                }
              }, 300000);
            }
          });
        }
      }, POLLING_INTERVAL);
      
      const handleNotificationUpdate = () => fetchNotifications(false);
      window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate);
      
      const handleStorageEvent = (e: StorageEvent) => {
        if (e.key === 'notification-update' || e.key === 'attendance-update') handleNotificationUpdate();
      };
      window.addEventListener('storage', handleStorageEvent);
      
      const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      const handleUserActivity = () => checkForNewNotifications();
      activityEvents.forEach(event => window.addEventListener(event, handleUserActivity));
      
      return () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        window.removeEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate);
        window.removeEventListener('storage', handleStorageEvent);
        activityEvents.forEach(event => window.removeEventListener(event, handleUserActivity));
      };
    }
  }, [session, fetchNotifications, checkForNewNotifications, fetchError]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchNotifications(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchNotifications]);

  // Actions
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });

      if (!response.ok) throw new Error("Failed to mark as read");

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      if (unread.length === 0) return;
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      try {
        await fetch('/api/notifications/mark-all-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
      } catch (apiError) {
        console.error('API error marking all read:', apiError);
        // Fallback to individual updates silently
        Promise.allSettled(unread.map(n => 
          fetch(`/api/notifications/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
          })
        ));
      }
    } catch (error) {
      console.error("Error in markAllAsRead:", error);
    }
  }, [notifications]);

  const handleItemClick = useCallback(async (n: Notification) => {
    try {
      const target = hrefFromRef(n, session?.user?.role);
      const unreadRaw = localStorage.getItem('unread_notifications');
      const unreadIds = unreadRaw ? JSON.parse(unreadRaw) as string[] : [];
      if (unreadIds.includes(n.id)) {
        localStorage.setItem('unread_notifications', JSON.stringify(unreadIds.filter(id => id !== n.id)));
      }
      if (!n.read) await markAsRead(n.id);
      
      setIsOpen(false);
      setTimeout(() => router.push(target), 150);
    } catch (e) {
      console.error('Error handling click:', e);
    }
  }, [session, router, markAsRead]);

  const handleOpen = useCallback((open: boolean) => {
    if (open && !isOpen) {
      fetchNotifications(false);
      if (unreadCount > 0) {
        setTimeout(() => markAllAsRead(), 1000); // Delay slightly longer for user to notice
      }
    }
    setIsOpen(open);
  }, [isOpen, unreadCount, fetchNotifications, markAllAsRead]);

  if (!session) return null;

  return (
    <Menu as="div" className="relative ml-3">
      {({ open }) => {
        return (
          <>
            <MenuOpenSync open={open} onChange={handleOpen} />
            {/* Backdrop for mobile */}
            <Transition
              show={open}
              as={Fragment}
              enter="transition-opacity duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 z-40 bg-gray-900/20 sm:hidden" />
            </Transition>

            <Menu.Button className="relative flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-95">
              <span className="sr-only">Notifikasi</span>
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95 translate-y-2"
              enterTo="transform opacity-100 scale-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="transform opacity-100 scale-100 translate-y-0"
              leaveTo="transform opacity-0 scale-95 translate-y-2"
            >
              <Menu.Items className="fixed left-2 right-2 top-16 z-50 mt-2 w-auto origin-top transform sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:w-screen sm:max-w-sm sm:origin-top-right sm:px-0">
                <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5">
                  {/* Header */}
                  <div className="relative bg-white/80 backdrop-blur-xl px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Notifikasi</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isRefreshing && (
                        <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin mr-2" />
                      )}
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                          title="Tandai semua dibaca"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                      <Menu.Item>
                        {({ close }) => (
                          <button
                            onClick={close}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </div>

                  {/* Error State */}
                  {fetchError && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Mode offline (cache)</span>
                      </div>
                      <button 
                        onClick={() => fetchNotifications(false)}
                        className="text-xs font-medium text-amber-700 underline"
                      >
                        Refresh
                      </button>
                    </div>
                  )}

                  {/* Notification List */}
                  <div className="max-h-[60vh] overflow-y-auto overscroll-contain bg-white">
                    {isLoading && notifications.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                        <RefreshCw className="w-8 h-8 animate-spin mb-3 opacity-20" />
                        <span className="text-sm">Memuat notifikasi...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                        <Bell className="w-12 h-12 mb-3 stroke-1 opacity-20" />
                        <span className="text-sm font-medium text-gray-500">Belum ada notifikasi</span>
                        <span className="text-xs text-gray-400 mt-1">Notifikasi baru akan muncul di sini</span>
                      </div>
                    ) : (
                      <div className="py-1">
                        {notifications.map((notification) => (
                          <Menu.Item key={notification.id}>
                            {({ active }) => (
                              <button
                                onClick={() => handleItemClick(notification)}
                                className={`w-full text-left px-4 py-3 flex gap-3 transition-colors relative group
                                  ${active ? "bg-gray-50" : "bg-white"}
                                  ${!notification.read ? "bg-indigo-50/40" : ""}
                                `}
                              >
                                {/* Icon Indicator */}
                                <div className={`flex-shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${getBgColor(notification.type)}`}>
                                  {getIcon(notification.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm leading-tight ${!notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                      {notification.title}
                                    </p>
                                    {!notification.read && (
                                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-600 mt-1.5" />
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-snug">
                                    {notification.message}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2">
                                    <div className="flex items-center text-[10px] font-medium text-gray-400">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {formatDate(notification.createdAt)}
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize
                                      ${notification.type === 'info' ? 'bg-blue-100 text-blue-700' :
                                        notification.type === 'success' ? 'bg-green-100 text-green-700' :
                                        notification.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                                        'bg-red-100 text-red-700'
                                      }
                                    `}>
                                      {notification.type === 'info' ? 'Info' : 
                                       notification.type === 'warning' ? 'Alert' : 
                                       notification.type === 'success' ? 'Sukses' : 'Penting'}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Hover Arrow */}
                                <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                                  <ChevronRight className="w-5 h-5" />
                                </div>
                              </button>
                            )}
                          </Menu.Item>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 text-center">
                    <Link
                      href="/notifications"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors inline-flex items-center gap-1"
                      onClick={() => setIsOpen(false)}
                    >
                      Lihat Semua Notifikasi
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </Menu.Items>
            </Transition>
          </>
        );
      }}
    </Menu>
  );
}
