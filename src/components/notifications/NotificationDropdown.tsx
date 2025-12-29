"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { Menu, Transition } from "@headlessui/react";
import { BellIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

// Create a custom event name for notification updates
export const NOTIFICATION_UPDATE_EVENT = 'notification-update';

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
  const POLLING_INTERVAL = 30000; // Interval polling 30 detik untuk mengurangi beban server
  const [fetchError, setFetchError] = useState<boolean>(false);

  // Fungsi untuk memeriksa status server API notifikasi
  const checkApiStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 detik timeout

      const response = await fetch("/api/health", {
        method: "HEAD", // Gunakan HEAD request karena hanya perlu cek status
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn("API server mungkin tidak tersedia:", error);
      return false;
    }
  }, []);

  // Fungsi fallback untuk notifikasi ketika server tidak merespons
  const getOfflineNotifications = useCallback(() => {
    try {
      // Coba mendapatkan notifikasi dari localStorage jika tersedia
      const cachedNotifications = localStorage.getItem('cached_notifications');
      if (cachedNotifications) {
        return JSON.parse(cachedNotifications);
      }
    } catch (error) {
      console.error("Error reading cached notifications:", error);
    }
    
    // Fallback ke data kosong jika tidak ada cache
    return {
      notifications: [],
      unreadCount: 0
    };
  }, []);

  // Fungsi untuk menyimpan notifikasi ke cache
  const cacheNotifications = useCallback((data: { notifications: Notification[], unreadCount: number }) => {
    try {
      localStorage.setItem('cached_notifications', JSON.stringify(data));
      const unreadIds = (data.notifications || []).filter(n => !n.read).map(n => n.id);
      localStorage.setItem('unread_notifications', JSON.stringify(unreadIds));
    } catch (error) {
      console.error("Error caching notifications:", error);
    }
  }, []);

  // Memoize the fetchNotifications function to avoid recreating it on every render
  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!session) return;
    
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 detik

    const fetchWithRetry = async () => {
      try {
        setFetchError(false);
        
        if (showLoading) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }

        // Periksa status API terlebih dahulu jika ini adalah retry
        if (retryCount > 0) {
          const apiAvailable = await checkApiStatus();
          if (!apiAvailable) {
            console.warn("API server tidak tersedia, menggunakan data cache");
            
            // Gunakan data cache jika server tidak tersedia
            const cachedData = getOfflineNotifications();
            setNotifications(cachedData.notifications || []);
            setUnreadCount(cachedData.unreadCount || 0);
            setFetchError(true);
            
            throw new Error("API server tidak tersedia");
          }
        }

        // Tambahkan timeout untuk fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 detik timeout (lebih lama)
        
        const response = await fetch("/api/notifications?limit=5&timestamp=" + Date.now(), {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Periksa apakah data memiliki flag error
        if (data.hasError) {
          console.warn("Partial error in notifications API response");
          setFetchError(true);
        } else {
          setFetchError(false);
        }
        
        const processedData = {
          notifications: data.notifications || [],
          unreadCount: data.unreadCount || 0
        };
        
        // Simpan data ke cache untuk fallback
        cacheNotifications(processedData);
        
        setNotifications(processedData.notifications);
        setUnreadCount(processedData.unreadCount);
        lastFetchTimeRef.current = Date.now();
      } catch (error: any) {
        // Tangani error dengan lebih spesifik
        setFetchError(true);
        
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          console.error("Koneksi jaringan terputus atau server tidak merespon:", error);
          
          // Gunakan data cache dalam kasus koneksi gagal
          const cachedData = getOfflineNotifications();
          setNotifications(cachedData.notifications || []);
          setUnreadCount(cachedData.unreadCount || 0);
          
          // Retry logic
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`Mencoba lagi (${retryCount}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return fetchWithRetry(); // Retry
          }
        } else if (error.name === 'AbortError') {
          console.error("Request timeout, server tidak merespon dalam waktu yang ditentukan");
          
          // Gunakan data cache dalam kasus timeout
          const cachedData = getOfflineNotifications();
          setNotifications(cachedData.notifications || []);
          setUnreadCount(cachedData.unreadCount || 0);
        } else {
          console.error("Error saat mengambil notifikasi:", error);
          
          // Untuk error lainnya, juga gunakan cache jika tersedia
          const cachedData = getOfflineNotifications();
          setNotifications(cachedData.notifications || []);
          setUnreadCount(cachedData.unreadCount || 0);
        }
      } finally {
        if (showLoading) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    };

    await fetchWithRetry();
  }, [session, checkApiStatus, getOfflineNotifications, cacheNotifications]);

  // Check for new notifications if user has been inactive
  const checkForNewNotifications = useCallback(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    // Jika sudah lebih dari interval, ambil data baru
    if (timeSinceLastFetch > POLLING_INTERVAL) {
      fetchNotifications(false);
    }
  }, [fetchNotifications]);

  // Setup polling and event listeners
  useEffect(() => {
    if (session) {
      // Initial fetch
      fetchNotifications().catch(err => console.error("Error pada initial fetch:", err));
      lastFetchTimeRef.current = Date.now();
      
      // Set up polling for notifications dengan error handling yang lebih baik
      pollingIntervalRef.current = setInterval(() => {
        // Hanya lakukan polling jika tidak ada error yang sedang berlangsung
        if (!fetchError) {
          fetchNotifications(false).catch(err => {
            console.error("Error pada polling fetch:", err);
            // Jika terjadi error berulang, hentikan polling sementara
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              // Restart polling setelah 5 menit
              setTimeout(() => {
                if (session) {
                  pollingIntervalRef.current = setInterval(() => {
                    fetchNotifications(false).catch(err => console.error("Error pada retry polling:", err));
                  }, POLLING_INTERVAL);
                }
              }, 300000); // 5 menit
            }
          });
        }
      }, POLLING_INTERVAL);
      
      // Set up global event listener for attendance actions
      const handleNotificationUpdate = () => {
        fetchNotifications(false).catch(err => console.error("Error pada event fetch:", err));
      };
      
      // Register the event listener
      window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate);
      
      // Add storage event untuk sinkronisasi antar tab dengan error handling
      const handleStorageEvent = (e: StorageEvent) => {
        try {
          if (e.key === 'notification-update' || e.key === 'attendance-update') {
            handleNotificationUpdate();
          }
        } catch (error) {
          console.error("Error handling storage event:", error);
        }
      };
      
      window.addEventListener('storage', handleStorageEvent);
      
      // Add event listeners for user activity to check for new notifications
      const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      const handleUserActivity = () => {
        try {
          checkForNewNotifications();
        } catch (error) {
          console.error("Error handling user activity:", error);
        }
      };
      
      activityEvents.forEach(event => {
        window.addEventListener(event, handleUserActivity);
      });
      
      // Clean up on unmount
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        window.removeEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate);
        window.removeEventListener('storage', handleStorageEvent);
        activityEvents.forEach(event => {
          window.removeEventListener(event, handleUserActivity);
        });
      };
    }
  }, [session, fetchNotifications, checkForNewNotifications, fetchError]);

  // Add a focus/visibility change event listener to refresh on tab focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(false).catch(err => console.error("Error pada visibility change fetch:", err));
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ read: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      // Update local state
      setNotifications(
        notifications.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Simpan notifikasi yang belum dibaca
      const unreadNotifications = notifications.filter((notification) => !notification.read);
      
      if (unreadNotifications.length === 0) {
        return; // Tidak ada notifikasi yang perlu ditandai
      }
      
      // Update state terlebih dahulu untuk respons UI yang cepat
      setNotifications(
        notifications.map((notification) => ({ ...notification, read: true }))
      );
      setUnreadCount(0);
      
      // Gunakan endpoint baru yang lebih efisien untuk menandai semua notifikasi sebagai dibaca
      try {
        const response = await fetch('/api/notifications/mark-all-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // Tambahkan timeout untuk permintaan
          signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
          console.warn('Failed to mark all notifications as read:', await response.text());
        } else {
          const result = await response.json();
          console.log(`Successfully marked ${result.count} notifications as read`);
        }
      } catch (apiError) {
        console.error('API error marking all notifications as read:', apiError);
        
        // Jika API gagal, gunakan metode lama dengan permintaan individual sebagai fallback
        const promises = unreadNotifications.map((notification) =>
          fetch(`/api/notifications/${notification.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ read: true }),
          }).catch(error => {
            console.error(`Error marking notification ${notification.id} as read:`, error);
            return null; // Return null untuk error, sehingga Promise.all tidak gagal
          })
        );

        // Gunakan allSettled untuk menangani kegagalan individual
        const results = await Promise.allSettled(promises);
        
        // Log error jika ada
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Failed to mark notification ${unreadNotifications[index]?.id} as read:`, result.reason);
          }
        });
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      // Tidak mengembalikan state, karena pengguna sudah melihat UI yang diperbarui
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      const absolute = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(date);
      return `${absolute} • ${minutes} menit lalu`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      const absolute = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(date);
      return `${absolute} • ${hours} jam lalu`;
    } else {
      return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(date);
    }
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

  const handleItemClick = async (n: Notification) => {
    try {
      const target = hrefFromRef(n, session?.user?.role);
      const unreadRaw = localStorage.getItem('unread_notifications');
      const unreadIds = unreadRaw ? JSON.parse(unreadRaw) as string[] : [];
      if (unreadIds.includes(n.id)) {
        const nextUnread = unreadIds.filter(id => id !== n.id);
        localStorage.setItem('unread_notifications', JSON.stringify(nextUnread));
      }
      if (!n.read) {
        await markAsRead(n.id);
      }
      setTimeout(() => {
        router.push(target);
      }, 150);
    } catch (e) {
      console.error('Error handling notification click:', e);
    }
  };

  // Handle dropdown open/close to fetch fresh notifications when opened
  const handleOpen = (open: boolean) => {
    if (open && !isOpen) {
      // Jalankan fetch dan mark-all-read secara terpisah untuk UX yang lebih responsif
      fetchNotifications(false);
      
      // Tandai semua notifikasi sebagai dibaca dengan delay singkat
      if (unreadCount > 0) {
        // Tampilkan efek count hilang secara langsung di UI
        setTimeout(() => {
          markAllAsRead();
        }, 300); // Delay 300ms agar efek visual terlihat
      }
    }
    setIsOpen(open);
  };

  if (!session) {
    return null;
  }

  return (
    <Menu as="div" className="relative ml-3">
      {({ open }) => {
        const MenuOpenEffect = ({ isOpen }: { isOpen: boolean }) => {
          useEffect(() => {
            handleOpen(isOpen);
          }, [isOpen]);
          return null;
        };
        
        return (
          <>
            <MenuOpenEffect isOpen={open} />
            {open && (
              <div className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity sm:hidden" aria-hidden="true" />
            )}
            <div>
              <Menu.Button className="relative flex rounded-full bg-white p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 min-h-[44px] min-w-[44px] items-center justify-center">
                <span className="sr-only">Lihat notifikasi</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 flex items-center justify-center text-xs font-medium text-white animate-pulse shadow-lg">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="fixed inset-x-4 top-20 z-50 mt-0 origin-top rounded-xl bg-white py-1 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none sm:absolute sm:inset-auto sm:right-0 sm:mt-2 sm:w-96 sm:origin-top-right sm:rounded-md sm:shadow-lg overflow-hidden">
                <div className="sticky top-0 z-20 bg-white px-4 py-3 border-b border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-medium text-gray-900">Notifikasi</h3>
                    <div className="flex items-center gap-2">
                      {isRefreshing && (
                        <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 py-1.5 px-3 rounded-full font-medium transition-colors shadow-sm"
                        >
                          Tandai dibaca
                        </button>
                      )}
                      <Menu.Item>
                        {({ close }: { close: () => void }) => (
                          <button
                            onClick={close}
                            className="p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                            aria-label="Tutup notifikasi"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </div>
                </div>

                {fetchError && (
                  <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100">
                    <div className="flex items-center text-yellow-800 text-xs">
                      <svg className="h-4 w-4 mr-1.5 text-yellow-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Menggunakan data cache. 
                      <button 
                        onClick={() => fetchNotifications(false)}
                        className="ml-1 underline font-medium"
                      >
                        Coba lagi
                      </button>
                    </div>
                  </div>
                )}

                <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto overscroll-y-contain">
                  {isLoading ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      Memuat notifikasi...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      Tidak ada notifikasi
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <Menu.Item key={notification.id}>
                        {({ active }: { active: boolean }) => (
                          <div
                            className={`${
                              active ? "bg-gray-50" : ""
                            } px-4 py-3 border-b border-gray-100 cursor-pointer ${
                              !notification.read ? "bg-indigo-50" : ""
                            }`}
                            onClick={() => handleItemClick(notification)}
                          >
                            <div className="flex items-start">
                              <div className="flex-shrink-0 mr-3">
                                <div
                                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                    notification.type === "info"
                                      ? "bg-blue-100 text-blue-500"
                                      : notification.type === "success"
                                      ? "bg-green-100 text-green-500"
                                      : notification.type === "warning"
                                      ? "bg-yellow-100 text-yellow-500"
                                      : "bg-red-100 text-red-500"
                                  }`}
                                >
                                  {notification.type === "info" ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                  ) : notification.type === "success" ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  ) : notification.type === "warning" ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                  <span>{notification.title}</span>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                                    notification.type === 'info' ? 'bg-blue-100 text-blue-800' :
                                    notification.type === 'success' ? 'bg-green-100 text-green-800' :
                                    notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {notification.type === 'info' ? 'Info' : notification.type === 'warning' ? 'Peringatan' : notification.type === 'success' ? 'Sukses' : 'Penting'}
                                  </span>
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatDate(notification.createdAt)}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="ml-2 flex-shrink-0">
                                  <span className="inline-block h-2 w-2 rounded-full bg-indigo-600"></span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Menu.Item>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 border-t border-gray-200 flex justify-between items-center">
                  <Link
                    href="/notifications"
                    className="block text-sm text-indigo-600 hover:text-indigo-900"
                  >
                    Lihat semua notifikasi
                  </Link>
                  <button 
                    onClick={() => fetchNotifications(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <span>Memperbarui...</span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Perbarui
                      </>
                    )}
                  </button>
                </div>
              </Menu.Items>
            </Transition>
          </>
        );
      }}
    </Menu>
  );
}
