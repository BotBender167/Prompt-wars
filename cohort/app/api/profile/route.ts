import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { INSTITUTION_NAME, DEPARTMENTS } from "@/lib/campus";

/**
 * Profile read/write for the Parivar tab.
 *
 * GET  /api/profile?id=<uuid>  → profile, interests, and connected-account
 *                                evidence (raw counts only — no scores, Rule 3)
 * PUT  /api/profile            → create or update a profile and its interests
 *
 * There is no auth session yet, so PUT trusts the `id` in the body when one is
 * supplied. That is a real hole — see lib/profile-id.ts.
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

/** Trim to null so empty form fields clear the column instead of storing "". */
function nullableText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
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
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    );
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

  const interests = Array.isArray(body.interests)
    ? Array.from(
        new Set(
          body.interests.filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0
          )
        )
      )
    : [];

  const supabase = createServerClient();

  // Every profile belongs to the seeded institution — discover and beacons both
  // inner-join on it, so a profile without it would be invisible everywhere.
  const { data: institution } = await supabase
    .from("institutions")
    .select("id")
    .eq("name", INSTITUTION_NAME)
    .maybeSingle();

  if (!institution) {
    return NextResponse.json(
      { error: "Institution not seeded — run supabase/migrations/0003_phase3.sql" },
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

  const existingId = nullableText(body.id, 36);

  const { data: profile, error: writeError } = existingId
    ? await supabase
        .from("profiles")
        .update(fields)
        .eq("id", existingId)
        .select("id")
        .single()
    : await supabase.from("profiles").insert(fields).select("id").single();

  if (writeError || !profile) {
    return NextResponse.json(
      { error: `Failed to save profile: ${writeError?.message ?? "unknown error"}` },
      { status: 500 }
    );
  }

  // Replace the interest set. Names come from the domains table, so an unknown
  // name is silently dropped rather than inserted as free text (Rule 1).
  const { error: clearError } = await supabase
    .from("profile_domains")
    .delete()
    .eq("profile_id", profile.id);

  if (clearError) {
    return NextResponse.json(
      { error: `Failed to update interests: ${clearError.message}` },
      { status: 500 }
    );
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
        return NextResponse.json(
          { error: `Failed to update interests: ${linkError.message}` },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ id: profile.id });
}
