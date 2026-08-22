import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchGitHubProfile } from "@/lib/providers/github";
import { fetchCodeforcesProfile } from "@/lib/providers/codeforces";
import { guardApiRequest } from "@/lib/api-security";
import { getAuthenticatedProfileId } from "@/lib/session";
import { isUuid } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ profileId: string }>;
}

/**
 * POST /api/sync/[profileId]
 *
 * Calls both the GitHub and Codeforces providers, then writes their
 * results into the respective cache tables.
 *
 * Returns:
 *   { synced_at, github_status, codeforces_status }
 *
 * Never exposes score, percentage, or confidence values (Rule 3).
 * All external API calls delegated to /lib/providers/* (Rule 4).
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const guarded = guardApiRequest(req, { limit: 10, requireSameOrigin: true });
  if (guarded) return guarded;

  const { profileId } = await params;

  if (!isUuid(profileId)) {
    return NextResponse.json(
      { error: "profileId must be a valid UUID" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const authenticatedProfileId = await getAuthenticatedProfileId(req, supabase);
  if (!authenticatedProfileId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (authenticatedProfileId !== profileId) {
    return NextResponse.json({ error: "Forbidden profile" }, { status: 403 });
  }

  // ── Load the profile to get handles ───────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, github_username, codeforces_handle")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const synced_at = new Date().toISOString();
  let github_status: "ok" | "error" = "error";
  let codeforces_status: "ok" | "error" = "error";

  // ── GitHub sync ────────────────────────────────────────────────────────────
  if (profile.github_username) {
    const ghResult = await fetchGitHubProfile(profile.github_username);
    if (ghResult.data) {
      const { error: upsertError } = await supabase
        .from("github_cache")
        .upsert(
          {
            profile_id: profileId,
            languages: ghResult.data.languages,
            commits_90d: ghResult.data.commits_90d,
            public_repos: ghResult.data.public_repos,
            synced_at,
          },
          { onConflict: "profile_id" }
        );
      github_status = upsertError ? "error" : "ok";
    }
    // If ghResult.error is set, github_status stays "error"
  }

  // ── Codeforces sync ────────────────────────────────────────────────────────
  if (profile.codeforces_handle) {
    const cfResult = await fetchCodeforcesProfile(profile.codeforces_handle);
    if (cfResult.data) {
      const { error: upsertError } = await supabase
        .from("codeforces_cache")
        .upsert(
          {
            profile_id: profileId,
            rating: cfResult.data.rating,
            max_rating: cfResult.data.maxRating,
            rank_title: cfResult.data.rank,
            problems_solved: cfResult.data.problemsSolved,
            synced_at,
          },
          { onConflict: "profile_id" }
        );
      codeforces_status = upsertError ? "error" : "ok";
    }
  }

  return NextResponse.json({ synced_at, github_status, codeforces_status });
}
