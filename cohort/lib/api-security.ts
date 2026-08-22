import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface ApiGuardOptions {
  limit: number;
  windowMs?: number;
  requireSameOrigin?: boolean;
}

const DEFAULT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_KEYS = 10_000;
const rateLimits = new Map<string, RateLimitEntry>();

export function requestOriginIsAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip");
  return address?.slice(0, 64) || "unknown";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = DEFAULT_WINDOW_MS,
  now = Date.now()
): RateLimitResult {
  const existing = rateLimits.get(key);

  if (!existing || now >= existing.resetAt) {
    if (rateLimits.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [storedKey, entry] of rateLimits) {
        if (now >= entry.resetAt) rateLimits.delete(storedKey);
      }
      if (rateLimits.size >= MAX_RATE_LIMIT_KEYS) {
        rateLimits.delete(rateLimits.keys().next().value as string);
      }
    }

    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1_000),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
  };
}

export function guardApiRequest(
  request: NextRequest,
  options: ApiGuardOptions
): NextResponse | null {
  if (options.requireSameOrigin && !requestOriginIsAllowed(request)) {
    return NextResponse.json({ error: "Forbidden request origin" }, { status: 403 });
  }

  const key = `${request.method}:${request.nextUrl.pathname}:${getClientIdentifier(request)}`;
  const result = checkRateLimit(
    key,
    options.limit,
    options.windowMs ?? DEFAULT_WINDOW_MS
  );

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSeconds) },
      }
    );
  }

  return null;
}

export function resetRateLimitsForTests(): void {
  rateLimits.clear();
}
