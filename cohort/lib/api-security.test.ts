import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test } from "vitest";
import {
  checkRateLimit,
  getClientIdentifier,
  guardApiRequest,
  requestOriginIsAllowed,
  resetRateLimitsForTests,
} from "./api-security";

describe("same-origin request protection", () => {
  test("accepts the exact request origin", () => {
    const request = new Request("https://example.com/api/profile", {
      headers: { origin: "https://example.com" },
    });

    expect(requestOriginIsAllowed(request)).toBe(true);
  });

  test.each([undefined, "https://evil.example", "null"])(
    "rejects an absent or foreign origin: %s",
    (origin) => {
      const headers = origin ? { origin } : undefined;
      expect(
        requestOriginIsAllowed(
          new Request("https://example.com/api/profile", { headers })
        )
      ).toBe(false);
    }
  );

  test("rejects a malformed origin header", () => {
    const request = new Request("https://example.com/api/profile", {
      headers: { origin: "not-an-origin" },
    });

    expect(requestOriginIsAllowed(request)).toBe(false);
  });
});

describe("client identification", () => {
  test("uses only the first forwarded address", () => {
    const request = new Request("https://example.com/api/profile", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });

    expect(getClientIdentifier(request)).toBe("203.0.113.9");
  });

  test("uses a stable fallback when forwarding headers are absent", () => {
    expect(getClientIdentifier(new Request("https://example.com/api/profile"))).toBe(
      "unknown"
    );
  });

  test("falls back to the direct proxy address", () => {
    const request = new Request("https://example.com/api/profile", {
      headers: { "x-real-ip": "203.0.113.10" },
    });

    expect(getClientIdentifier(request)).toBe("203.0.113.10");
  });
});

describe("bounded request limiting", () => {
  beforeEach(resetRateLimitsForTests);

  test("allows requests through the configured limit", () => {
    expect(checkRateLimit("key", 2, 1_000, 0).allowed).toBe(true);
    expect(checkRateLimit("key", 2, 1_000, 1).allowed).toBe(true);
  });

  test("rejects the request beyond the limit and supplies retry timing", () => {
    checkRateLimit("key", 1, 1_000, 100);
    expect(checkRateLimit("key", 1, 1_000, 200)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1,
    });
  });

  test("starts a fresh window after expiry", () => {
    checkRateLimit("key", 1, 1_000, 100);
    expect(checkRateLimit("key", 1, 1_000, 1_100).allowed).toBe(true);
  });

  test("evicts the oldest active key when the bounded store is full", () => {
    for (let index = 0; index < 10_000; index += 1) {
      checkRateLimit(`key-${index}`, 1, 60_000, 0);
    }
    checkRateLimit("overflow", 1, 60_000, 0);

    expect(checkRateLimit("key-0", 1, 60_000, 1).allowed).toBe(true);
  });

  test("removes expired keys before evicting active ones", () => {
    for (let index = 0; index < 10_000; index += 1) {
      checkRateLimit(`expired-${index}`, 1, 1, 0);
    }

    expect(checkRateLimit("fresh", 1, 1_000, 2).allowed).toBe(true);
  });
});

describe("API guard responses", () => {
  beforeEach(resetRateLimitsForTests);

  test("returns 403 before route logic for a cross-origin write", async () => {
    const request = new NextRequest("https://example.com/api/profile", {
      method: "PUT",
      headers: { origin: "https://evil.example" },
    });

    const response = guardApiRequest(request, {
      requireSameOrigin: true,
      limit: 10,
    });

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "Forbidden request origin" });
  });

  test("returns 429 when the route limit is exhausted", () => {
    const request = new NextRequest("https://example.com/api/discover", {
      method: "POST",
      headers: {
        origin: "https://example.com",
        "x-forwarded-for": "203.0.113.9",
      },
    });

    expect(guardApiRequest(request, { limit: 1 })).toBeNull();
    const response = guardApiRequest(request, { limit: 1 });

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("60");
  });
});
