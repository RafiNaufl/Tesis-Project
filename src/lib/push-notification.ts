import { firebaseAdmin } from './firebase-admin';
import { prisma } from './prisma';

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  try {
    // Check if Firebase is initialized
    if (!firebaseAdmin.apps.length) {
      console.warn('Firebase Admin not initialized. Skipping push notification.');
      return;
    }

    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    // Remove duplicates
    const uniqueTokens = [...new Set(tokens.map(t => t.token))];

    const message: any = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens: uniqueTokens,
    };

    // sendMulticast handles multiple tokens
    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    
    // Cleanup invalid tokens if any
    if (response.failureCount > 0) {
       const failedTokens: string[] = [];
       response.responses.forEach((resp, idx) => {
         if (!resp.success) {
           const error = resp.error;
           if (error?.code === 'messaging/invalid-registration-token' ||
               error?.code === 'messaging/registration-token-not-registered') {
             failedTokens.push(uniqueTokens[idx]);
           }
         }
       });
       
       if (failedTokens.length > 0) {
         await prisma.deviceToken.deleteMany({
           where: { token: { in: failedTokens } }
         });
         console.log(`Removed ${failedTokens.length} invalid tokens.`);
       }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};
