import { NextResponse } from 'next/server';

/**
 * Endpoint untuk health check
 * Endpoint ini dapat digunakan untuk memastikan server API berjalan dengan baik
 */
export async function GET() {
  try {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
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