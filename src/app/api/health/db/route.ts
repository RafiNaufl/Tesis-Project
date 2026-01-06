
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    // Simple query to test connection
    const count = await prisma.user.count();
    const duration = Date.now() - startTime;
    
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Database connection successful', 
      userCount: count,
      duration: `${duration}ms`
    }, { status: 200 });
  } catch (error: any) {
    console.error('Database connection failed:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: 'Database connection failed', 
      error: error.message,
      code: error.code,
      meta: error.meta
    }, { status: 500 });
  }
}
