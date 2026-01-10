import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/push-notification';
import { firebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tokens for the current user
    const tokens = await prisma.deviceToken.findMany({
      where: { userId: session.user.id },
      select: { token: true, platform: true, createdAt: true }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No device tokens found for this user',
        tokens: []
      });
    }

    const tokenStrings = tokens.map(t => t.token);

    // Try sending a direct test message using firebase-admin to get detailed response
    const message = {
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification sent at ' + new Date().toLocaleTimeString(),
      },
      tokens: tokenStrings,
    };

    let result;
    try {
       // We use sendEachForMulticast directly here to get detailed failure responses
       if (firebaseAdmin.apps.length) {
         result = await firebaseAdmin.messaging().sendEachForMulticast(message);
       } else {
         return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
       }
    } catch (e: any) {
      return NextResponse.json({ 
        success: false, 
        message: 'Firebase send failed', 
        error: e.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tokenCount: tokens.length,
      tokens: tokens, // Return tokens info for debugging
      firebaseResult: {
        successCount: result.successCount,
        failureCount: result.failureCount,
        responses: result.responses
      }
    });

  } catch (error: any) {
    console.error('Error in test-notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
