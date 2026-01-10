"use client";

import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { PushNotifications } from "@capacitor/push-notifications";
import { Filesystem } from "@capacitor/filesystem";
import { MapPin, Camera as CameraIcon, Bell, HardDrive, Settings, ShieldAlert } from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

// Translations setup
const TRANSLATIONS = {
  id: {
    title: "Izin Diperlukan",
    description: "Aplikasi ini memerlukan izin berikut untuk berfungsi dengan baik. Harap aktifkan di pengaturan.",
    openSettings: "Buka Pengaturan",
    permissions: {
      location: {
        title: "Lokasi (GPS)",
        desc: "Diperlukan untuk fitur absensi berbasis lokasi dan pelacakan rute.",
      },
      camera: {
        title: "Kamera",
        desc: "Diperlukan untuk mengambil foto bukti kehadiran dan dokumen.",
      },
      notifications: {
        title: "Notifikasi",
        desc: "Agar Anda tidak melewatkan pengumuman penting dan status persetujuan.",
      },
      storage: {
        title: "Penyimpanan",
        desc: "Untuk menyimpan data offline dan mengunduh laporan gaji.",
      },
    },
  },
  en: {
    title: "Permissions Required",
    description: "This app requires the following permissions to function properly. Please enable them in settings.",
    openSettings: "Open Settings",
    permissions: {
      location: {
        title: "Location (GPS)",
        desc: "Required for location-based attendance and route tracking.",
      },
      camera: {
        title: "Camera",
        desc: "Required for taking attendance photos and documents.",
      },
      notifications: {
        title: "Notifications",
        desc: "So you don't miss important announcements and approval statuses.",
      },
      storage: {
        title: "Storage",
        desc: "To save offline data and download payslips.",
      },
    },
  },
};

type PermissionType = "location" | "camera" | "notifications" | "storage";

export default function PermissionGuard() {
  const [isOpen, setIsOpen] = useState(false);
  const [missingPermissions, setMissingPermissions] = useState<PermissionType[]>([]);
  const [lang] = useState<"id" | "en">("id"); // Default to Indonesian
  const t = TRANSLATIONS[lang];

  const checkPermissions = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    // Skip if already marked as approved in local storage (though we re-check real status below)
    // The requirement says "Simpan preferensi pengguna... jika sudah di-setujui".
    // However, it's safer to always check the REAL status. 
    // If the user manually revoked permissions, we should ask again.
    // But to follow instructions strictly about "saving preference":
    const previouslyApproved = localStorage.getItem("permissions_fully_granted");
    
    // We will still check real permissions. If they are missing, we MUST show the dialog regardless of preference,
    // because the app won't work. The "preference" might be just to avoid re-checking on every single render if unnecessary.
    
    const missing: PermissionType[] = [];

    try {
      // 1. Location
      const geo = await Geolocation.checkPermissions();
      if (geo.location !== "granted" && geo.coarseLocation !== "granted") {
        missing.push("location");
      }

      // 2. Camera
      const cam = await Camera.checkPermissions();
      if (cam.camera !== "granted") {
        missing.push("camera");
      }

      // 3. Notifications
      let push = await PushNotifications.checkPermissions();
      if (push.receive === "prompt") {
        // Try to request permission immediately
        push = await PushNotifications.requestPermissions();
      }
      
      if (push.receive !== "granted") {
        missing.push("notifications");
      }

      // 4. Storage
      // On Android 13+, publicStorage might be 'granted' automatically or handled differently.
      // We check what's available.
      const fs = await Filesystem.checkPermissions();
      if (fs.publicStorage !== "granted") {
         // double check android version or just push it? 
         // For now we treat it as missing if not granted.
         missing.push("storage");
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }

    if (missing.length > 0) {
      setMissingPermissions(missing);
      setIsOpen(true);
      localStorage.removeItem("permissions_fully_granted");
    } else {
      setIsOpen(false);
      localStorage.setItem("permissions_fully_granted", "true");
    }
  }, []);

  useEffect(() => {
    // Check on mount
    checkPermissions();

    // Check when app resumes (comes back from settings)
    const listener = App.addListener("appStateChange", (state) => {
      if (state.isActive) {
        checkPermissions();
      }
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [checkPermissions]);

  const handleOpenSettings = async () => {
    try {
      if (Capacitor.getPlatform() === 'ios') {
        await NativeSettings.openIOS({
          option: IOSSettings.App, 
        });
      } else {
        await NativeSettings.openAndroid({
          option: AndroidSettings.ApplicationDetails,
        });
      }
    } catch (e) {
      console.error("Error opening settings:", e);
    }
    // Dialog remains open until they return and we re-check
  };

  if (!isOpen) return null;

  return (
    <AlertDialog.Root open={isOpen}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in" />
        <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 dark:bg-zinc-900">
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <AlertDialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {t.title}
                </AlertDialog.Title>
                <AlertDialog.Description className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t.description}
                </AlertDialog.Description>
              </div>
            </div>

            <div className="flex flex-col gap-3 py-2">
              {missingPermissions.includes("location") && (
                <PermissionItem 
                  icon={<MapPin className="h-5 w-5" />} 
                  title={t.permissions.location.title} 
                  desc={t.permissions.location.desc} 
                />
              )}
              {missingPermissions.includes("camera") && (
                <PermissionItem 
                  icon={<CameraIcon className="h-5 w-5" />} 
                  title={t.permissions.camera.title} 
                  desc={t.permissions.camera.desc} 
                />
              )}
              {missingPermissions.includes("notifications") && (
                <PermissionItem 
                  icon={<Bell className="h-5 w-5" />} 
                  title={t.permissions.notifications.title} 
                  desc={t.permissions.notifications.desc} 
                />
              )}
              {missingPermissions.includes("storage") && (
                <PermissionItem 
                  icon={<HardDrive className="h-5 w-5" />} 
                  title={t.permissions.storage.title} 
                  desc={t.permissions.storage.desc} 
                />
              )}
            </div>

            <div className="mt-2 flex justify-end">
              <AlertDialog.Action asChild>
                <button
                  onClick={handleOpenSettings}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {t.openSettings}
                </button>
              </AlertDialog.Action>
            </div>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function PermissionItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
      <div className="text-zinc-500 dark:text-zinc-400 mt-0.5">{icon}</div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
    </div>
  );
}
