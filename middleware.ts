import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === "true";
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || "100", 10);

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!RATE_LIMIT_ENABLED) return NextResponse.next();

  // Only rate limit API routes
  if (!pathname.startsWith("/api")) return NextResponse.next();
  // Allow health checks freely
  if (pathname === "/api/health") return NextResponse.next();

  const ipHeader = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  const ip = ipHeader ? ipHeader.split(",")[0].trim() : "unknown";
  const now = Date.now();

  const bucket = buckets.get(ip as string) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }

  bucket.count += 1;
  buckets.set(ip as string, bucket);

  if (bucket.count > MAX_REQUESTS) {
    const res = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    res.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    res.headers.set("X-RateLimit-Remaining", "0");
    res.headers.set("X-RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res;
  }

  const remaining = Math.max(0, MAX_REQUESTS - bucket.count);
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1000)));
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
