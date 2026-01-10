'use client';

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export default function PushNotificationManager() {
  const { data: session } = useSession();

  useEffect(() => {
    // Only run on native platforms and when user is logged in
    if (!session?.user || !Capacitor.isNativePlatform()) {
      return;
    }

    const registerPush = async () => {
      try {
        // Create channel specifically for Android
        if (Capacitor.getPlatform() === 'android') {
          await PushNotifications.createChannel({
            id: 'default',
            name: 'Default Channel',
            description: 'General Notifications',
            importance: 5, // High importance
            visibility: 1, // Public
            vibration: true,
          });
        }

        const permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          const newStatus = await PushNotifications.requestPermissions();
          if (newStatus.receive === 'granted') {
            await PushNotifications.register();
          }
        } else if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch (e) {
        console.error('Error registering push:', e);
      }
    };

    registerPush();

    const registrationListener = PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Debug toast (optional, can be removed later)
      toast.success('Device registered for notifications'); 
      
      try {
        await fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: token.value,
            platform: Capacitor.getPlatform(),
          }),
        });
      } catch (e) {
        console.error('Failed to send token to server', e);
      }
    });

    const registrationErrorListener = PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Handle incoming notifications (optional)
    const notificationReceivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
       console.log('Push received: ', notification);
       
       // Show toast for foreground notification
       toast(notification.title || 'New Notification', {
         icon: '🔔',
         duration: 4000,
       });

       // Dispatch event to update notification list
       window.dispatchEvent(new Event('notification-update'));
    });

    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      notificationReceivedListener.then(l => l.remove());
    };
  }, [session]);

  return null;
}
