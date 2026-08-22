import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const PROFILE_SESSION_COOKIE = "parivar_session";
const PROFILE_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export const profileSessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: PROFILE_SESSION_TTL_SECONDS,
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function hashSessionToken(token: string): Promise<string> {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createProfileSession(
  supabase: SupabaseClient,
  profileId: string,
  now = new Date()
): Promise<string | null> {
  const token = createSessionToken();
  const expiresAt = new Date(
    now.getTime() + PROFILE_SESSION_TTL_SECONDS * 1_000
  ).toISOString();
  const { error } = await supabase.from("profile_sessions").insert({
    profile_id: profileId,
    token_hash: await hashSessionToken(token),
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Failed to create profile session", error);
    return null;
  }

  return token;
}

export async function getAuthenticatedProfileId(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<string | null> {
  const token = request.cookies.get(PROFILE_SESSION_COOKIE)?.value;
  if (!isSessionToken(token)) return null;

  const { data, error } = await supabase
    .from("profile_sessions")
    .select("profile_id")
    .eq("token_hash", await hashSessionToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Failed to read profile session", error);
    return null;
  }

  return typeof data?.profile_id === "string" ? data.profile_id : null;
}

export function setProfileSessionCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set(PROFILE_SESSION_COOKIE, token, profileSessionCookieOptions);
}
