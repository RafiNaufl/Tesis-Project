"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { Menu, Transition } from "@headlessui/react";
import { BellIcon } from "@heroicons/react/24/outline";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

// Create a custom event name for notification updates
export const NOTIFICATION_UPDATE_EVENT = 'notification-update';

export default function NotificationDropdown() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const POLLING_INTERVAL = 1000; // Interval polling 10 detik, lebih cepat dari 30 detik

  // Memoize the fetchNotifications function to avoid recreating it on every render
  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!session) return;
    
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      // Tambahkan timeout untuk fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 detik timeout
      
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
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      lastFetchTimeRef.current = Date.now();
    } catch (error: any) {
      // Tangani error dengan lebih spesifik
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error("Koneksi jaringan terputus atau server tidak merespon:", error);
      } else if (error.name === 'AbortError') {
        console.error("Request timeout, server tidak merespon dalam waktu yang ditentukan");
      } else {
        console.error("Error saat mengambil notifikasi:", error);
      }
      // Jangan ubah state notifikasi jika terjadi error
    } finally {
      if (showLoading) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [session]);

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
      fetchNotifications();
      lastFetchTimeRef.current = Date.now();
      
      // Set up polling for notifications - check every 10 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchNotifications(false);
      }, POLLING_INTERVAL);
      
      // Set up global event listener for attendance actions
      const handleNotificationUpdate = () => {
        fetchNotifications(false);
      };
      
      // Register the event listener
      window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate);
      
      // Add event listeners for user activity to check for new notifications
      const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      const handleUserActivity = () => {
        checkForNewNotifications();
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
        activityEvents.forEach(event => {
          window.removeEventListener(event, handleUserActivity);
        });
      };
    }
  }, [session, fetchNotifications, checkForNewNotifications]);

  // Add a focus/visibility change event listener to refresh on tab focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(false);
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
      const promises = notifications
        .filter((notification) => !notification.read)
        .map((notification) =>
          fetch(`/api/notifications/${notification.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ read: true }),
          })
        );

      await Promise.all(promises);

      // Update local state
      setNotifications(
        notifications.map((notification) => ({ ...notification, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Handle dropdown open/close to fetch fresh notifications when opened
  const handleOpen = (open: boolean) => {
    if (open && !isOpen) {
      fetchNotifications(false);
    }
    setIsOpen(open);
  };

  if (!session) {
    return null;
  }

  return (
    <Menu as="div" className="relative ml-3">
      {({ open }) => {
        // Call the handleOpen function when the open state changes
        useEffect(() => {
          handleOpen(open);
        }, [open]);
        
        return (
          <>
            <div>
              <Menu.Button className="relative flex rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                <span className="sr-only">Lihat notifikasi</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 flex items-center justify-center text-xs font-medium text-white animate-pulse shadow-lg">
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
              <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-4 py-2 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-900">Notifikasi</h3>
                    <div className="flex items-center">
                      {isRefreshing && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-indigo-600 hover:text-indigo-900"
                        >
                          Tandai semua dibaca
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
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
                            onClick={() => !notification.read && markAsRead(notification.id)}
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
                                <p className="text-sm font-medium text-gray-900">
                                  {notification.title}
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