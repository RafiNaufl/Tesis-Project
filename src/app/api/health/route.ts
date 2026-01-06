import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Endpoint untuk health check
 * Endpoint ini dapat digunakan untuk memastikan server API berjalan dengan baik
 */
export async function GET() {
  try {
    // Check database connectivity
    let dbOk = false;
    try {
      const result = await db.$queryRaw`SELECT NOW()`;
      dbOk = Array.isArray(result) || !!result;
    } catch {
      dbOk = false;
    }

    return NextResponse.json({ status: 'ok', db: dbOk ? 'connected' : 'error', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

export async function HEAD() {
  try {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
