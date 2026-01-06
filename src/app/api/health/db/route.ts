
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Log masked connection string for debugging
    const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
    const maskedUrl = dbUrl.replace(/:[^:@]*@/, ':****@');
    console.log(`[DB Health] Attempting connection to: ${maskedUrl}`);
    
    // Simple query to test connection
    const count = await prisma.user.count();
    const duration = Date.now() - startTime;
    
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Database connection successful', 
      userCount: count,
      duration: `${duration}ms`,
      connectionInfo: {
        url: maskedUrl,
        env: process.env.NODE_ENV
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('Database connection failed:', error);
    
    const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
    const maskedUrl = dbUrl.replace(/:[^:@]*@/, ':****@');
    
    return NextResponse.json({ 
      status: 'error', 
      message: 'Database connection failed', 
      error: error.message,
      code: error.code,
      meta: error.meta,
      connectionTried: maskedUrl
    }, { status: 500 });
  }
}
