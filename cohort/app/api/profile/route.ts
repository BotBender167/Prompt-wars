import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { INSTITUTION_NAME, DEPARTMENTS } from "@/lib/campus";
import { guardApiRequest } from "@/lib/api-security";
import {
  createProfileSession,
  getAuthenticatedProfileId,
  setProfileSessionCookie,
} from "@/lib/session";
import { isUuid, normalizeInterests, nullableText } from "@/lib/validation";

/**
 * Profile read/write for the Parivar tab.
 *
 * GET  /api/profile?id=<uuid>  → profile, interests, and connected-account
 *                                evidence (raw counts only — no scores, Rule 3)
 * PUT  /api/profile            → create or update a profile and its interests
 *
 * Profile ownership is bound to a hashed server-side session referenced by an
 * HttpOnly cookie. The local profile id is only a UI pointer, not authority.
 */

interface ProfileBody {
  id?: string;
  full_name?: string;
  year?: number | null;
  department?: string | null;
  current_project?: string | null;
  looking_for?: string | null;
  bio?: string | null;
  interests?: string[];
  github_username?: string | null;
  codeforces_handle?: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guarded = guardApiRequest(req, { limit: 60 });
  if (guarded) return guarded;

  const id = req.nextUrl.searchParams.get("id");
  if (!isUuid(id)) {
    return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, full_name, year, department, bio, current_project, looking_for,
       github_username, codeforces_handle,
       profile_domains ( domains ( name ) ),
       github_cache ( languages, commits_90d, public_repos, synced_at ),
       codeforces_cache ( rating, rank_title, problems_solved, synced_at )`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const row = data as unknown as {
    profile_domains: { domains: { name: string } | null }[];
    [key: string]: unknown;
  };

  return NextResponse.json({
    profile: {
      ...data,
      interests: (row.profile_domains ?? [])
        .map((pd) => pd.domains?.name)
        .filter(Boolean),
    },
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const guarded = guardApiRequest(req, { limit: 20, requireSameOrigin: true });
  if (guarded) return guarded;

  let body: ProfileBody;
  try {
    body = (await req.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const full_name = nullableText(body.full_name, 120);
  if (!full_name) {
    return NextResponse.json(
      { error: "full_name is required" },
      { status: 400 }
    );
  }

  const department = nullableText(body.department, 120);
  if (department && !DEPARTMENTS.includes(department)) {
    return NextResponse.json(
      { error: "department is not a recognised department" },
      { status: 400 }
    );
  }

  let year: number | null = null;
  if (body.year !== null && body.year !== undefined && body.year !== ("" as never)) {
    const n = Number(body.year);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json(
        { error: "year must be a whole number between 1 and 5" },
        { status: 400 }
      );
    }
    year = n;
  }

  const interests = normalizeInterests(body.interests, 40, 80);

  const supabase = createServerClient();
  const requestedId = body.id ?? null;
  if (requestedId !== null && !isUuid(requestedId)) {
    return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 });
  }

  const authenticatedProfileId = await getAuthenticatedProfileId(req, supabase);
  if (requestedId && authenticatedProfileId && requestedId !== authenticatedProfileId) {
    return NextResponse.json({ error: "Forbidden profile" }, { status: 403 });
  }

  // A stale localStorage id without its matching HttpOnly cookie creates a new
  // profile. It can never be used to take over the referenced profile.
  const existingId = requestedId === authenticatedProfileId ? requestedId : null;

  // Every profile belongs to the seeded institution — discover and beacons both
  // inner-join on it, so a profile without it would be invisible everywhere.
  const { data: institution } = await supabase
    .from("institutions")
    .select("id")
    .eq("name", INSTITUTION_NAME)
    .maybeSingle();

  if (!institution) {
    console.error("Institution seed is missing");
    return NextResponse.json(
      { error: "Profile service is unavailable" },
      { status: 500 }
    );
  }

  const fields = {
    full_name,
    year,
    department,
    bio: nullableText(body.bio, 500),
    current_project: nullableText(body.current_project, 500),
    looking_for: nullableText(body.looking_for, 500),
    github_username: nullableText(body.github_username, 39),
    codeforces_handle: nullableText(body.codeforces_handle, 39),
    institution_id: institution.id,
  };

  const { data: profile, error: writeError } = existingId
    ? await supabase
        .from("profiles")
        .update(fields)
        .eq("id", existingId)
        .select("id")
        .single()
    : await supabase.from("profiles").insert(fields).select("id").single();

  if (writeError || !profile) {
    console.error("Failed to save profile", writeError);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  // Replace the interest set. Names come from the domains table, so an unknown
  // name is silently dropped rather than inserted as free text (Rule 1).
  const { error: clearError } = await supabase
    .from("profile_domains")
    .delete()
    .eq("profile_id", profile.id);

  if (clearError) {
    console.error("Failed to clear profile interests", clearError);
    if (!existingId) await supabase.from("profiles").delete().eq("id", profile.id);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  if (interests.length > 0) {
    const { data: domains } = await supabase
      .from("domains")
      .select("id")
      .in("name", interests);

    if (domains && domains.length > 0) {
      const { error: linkError } = await supabase.from("profile_domains").insert(
        domains.map((d) => ({ profile_id: profile.id, domain_id: d.id }))
      );
      if (linkError) {
        console.error("Failed to link profile interests", linkError);
        if (!existingId) await supabase.from("profiles").delete().eq("id", profile.id);
        return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
      }
    }
  }

  const response = NextResponse.json({ id: profile.id });
  if (!existingId) {
    const token = await createProfileSession(supabase, profile.id);
    if (!token) {
      await supabase.from("profiles").delete().eq("id", profile.id);
      return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }
    setProfileSessionCookie(response, token);
  }

  return response;
}
