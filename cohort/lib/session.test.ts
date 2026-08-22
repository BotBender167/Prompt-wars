import { NextRequest, NextResponse } from "next/server";
import { describe, expect, test, vi } from "vitest";
import {
  createProfileSession,
  createSessionToken,
  getAuthenticatedProfileId,
  hashSessionToken,
  isSessionToken,
  profileSessionCookieOptions,
  setProfileSessionCookie,
} from "./session";

describe("profile session tokens", () => {
  test("creates URL-safe tokens with 256 bits of entropy", () => {
    const token = createSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isSessionToken(token)).toBe(true);
  });

  test("creates a different token for each session", () => {
    expect(createSessionToken()).not.toBe(createSessionToken());
  });

  test.each(["", "short", "contains spaces", "a".repeat(44)])(
    "rejects malformed tokens: %s",
    (token) => expect(isSessionToken(token)).toBe(false)
  );

  test("hashes tokens deterministically without storing the bearer value", async () => {
    const token = createSessionToken();
    const hash = await hashSessionToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(hashSessionToken(token)).resolves.toBe(hash);
    expect(hash).not.toContain(token);
  });

  test("uses hardened HttpOnly cookie settings", () => {
    expect(profileSessionCookieOptions).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  test("stores only a hash when creating a server-side session", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ insert })) };

    const token = await createProfileSession(
      client as never,
      "550e8400-e29b-41d4-a716-446655440000",
      new Date("2026-01-01T00:00:00.000Z")
    );

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(client.from).toHaveBeenCalledWith("profile_sessions");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "550e8400-e29b-41d4-a716-446655440000",
        expires_at: "2026-01-31T00:00:00.000Z",
        token_hash: await hashSessionToken(token as string),
      })
    );
  });

  test("resolves a valid cookie to its server-owned profile", async () => {
    const token = createSessionToken();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { profile_id: "550e8400-e29b-41d4-a716-446655440000" },
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const client = { from: vi.fn(() => query) };
    const request = new NextRequest("https://example.com/api/profile", {
      headers: { cookie: `parivar_session=${token}` },
    });

    await expect(getAuthenticatedProfileId(request, client as never)).resolves.toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(query.eq).toHaveBeenCalledWith("token_hash", await hashSessionToken(token));
  });

  test("does not query the database for a malformed cookie", async () => {
    const client = { from: vi.fn() };
    const request = new NextRequest("https://example.com/api/profile", {
      headers: { cookie: "parivar_session=short" },
    });

    await expect(getAuthenticatedProfileId(request, client as never)).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  test("sets the hardened session cookie on a response", () => {
    const token = createSessionToken();
    const response = NextResponse.json({ ok: true });

    setProfileSessionCookie(response, token);

    expect(response.cookies.get("parivar_session")?.value).toBe(token);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  });
});
