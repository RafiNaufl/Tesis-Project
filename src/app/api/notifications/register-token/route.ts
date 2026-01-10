import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token, platform } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    await prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId: session.user.id,
        platform: platform || 'android',
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        token,
        platform: platform || 'android',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registering token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
