/**
 * Supabase server client factory.
 * Use this in Server Components, Route Handlers, and Server Actions.
 * A new client instance is created per call (no singleton — avoids
 * cross-request session leakage).
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← server-only, never exposed to the browser
 */
import { createClient } from "@supabase/supabase-js";

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Server-side clients must not persist sessions.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
