import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { INSTITUTION_NAME } from "@/lib/campus";
import { sanitizeForFilter } from "@/lib/search";
import { guardApiRequest } from "@/lib/api-security";
import { normalizeInterests, nullableText } from "@/lib/validation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiscoverRequestBody {
  query?: string;
  department?: string;
  interests?: string[];
}

interface DiscoverResult {
  id: string;
  name: string;
  year: number | null;
  department: string | null;
  current_project: string | null;
  looking_for: string | null;
  bio: string | null;
  interests: string[];
  github: {
    languages: Record<string, number>;
    commits_90d: number;
  } | null;
  codeforces: {
    rating: number;
    rank: string;
  } | null;
}

interface RawProfile {
  id: string;
  full_name: string;
  year: number | null;
  department: string | null;
  bio: string | null;
  current_project: string | null;
  looking_for: string | null;
  profile_domains: Array<{ domains: { name: string } | null }>;
  github_cache: {
    languages: Record<string, number> | null;
    commits_90d: number | null;
  } | null;
  codeforces_cache: {
    rating: number | null;
    rank_title: string | null;
  } | null;
}

// ponytail: flat cap instead of paging. Fine for one campus; add a cursor when a
// single institution outgrows it.
const MAX_RESULTS = 200;

// ── Ranking helpers ────────────────────────────────────────────────────────
// Used only for ordering — no score, percentage, or confidence is ever
// returned to the client (Rule 3).

function interestOverlap(queryInterests: string[], profileInterests: string[]): number {
  if (queryInterests.length === 0) return 0;
  const qi = new Set(queryInterests.map((s) => s.toLowerCase()));
  return profileInterests.filter((i) => qi.has(i.toLowerCase())).length;
}

function recencyBucket(commits_90d: number | null | undefined): number {
  const n = commits_90d ?? 0;
  if (n > 10) return 3;
  if (n >= 4) return 2;
  return n > 0 ? 1 : 0;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guarded = guardApiRequest(req, { limit: 30 });
  if (guarded) return guarded;

  let body: DiscoverRequestBody;
  try {
    body = (await req.json()) as DiscoverRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = sanitizeForFilter((body.query ?? "").trim());
  const department = nullableText(body.department, 120) ?? "";
  const queryInterests = normalizeInterests(body.interests, 40, 80);

  const supabase = createServerClient();

  // Interests are resolved to profile ids first. Filtering them inside the main
  // select would need an inner join on the same embed the cards read from, which
  // would also trim each card's interest list down to just the matched ones.
  let interestProfileIds: string[] | null = null;
  if (queryInterests.length > 0) {
    const { data: matches, error: interestError } = await supabase
      .from("profile_domains")
      .select("profile_id, domains!inner ( name )")
      .in("domains.name", queryInterests);

    if (interestError) {
      console.error("Failed to search profile interests", interestError);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    interestProfileIds = Array.from(
      new Set((matches ?? []).map((m) => m.profile_id as string))
    );

    // Nobody holds any of the selected interests — skip the second round trip.
    if (interestProfileIds.length === 0) {
      return NextResponse.json({ results: [], count: 0 });
    }
  }

  let dbQuery = supabase
    .from("profiles")
    .select(
      `id, full_name, year, department, bio, current_project, looking_for,
       institutions!inner ( name ),
       profile_domains ( domains ( name ) ),
       github_cache ( languages, commits_90d ),
       codeforces_cache ( rating, rank_title )`
    )
    .eq("institutions.name", INSTITUTION_NAME)
    .limit(MAX_RESULTS);

  if (department) {
    dbQuery = dbQuery.eq("department", department);
  }

  if (interestProfileIds) {
    dbQuery = dbQuery.in("id", interestProfileIds);
  }

  // Text search runs in SQL rather than over every row in memory.
  if (query) {
    const like = `%${query}%`;
    dbQuery = dbQuery.or(
      `full_name.ilike.${like},bio.ilike.${like},current_project.ilike.${like},looking_for.ilike.${like}`
    );
  }

  const { data: profiles, error: dbError } = await dbQuery;

  if (dbError) {
    console.error("Failed to search profiles", dbError);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ results: [], count: 0 });
  }

  // ── Sort: (1) interest overlap ▸ (2) recent activity ▸ (3) CF rating ──────
  const sorted = [...(profiles as unknown as RawProfile[])].sort((a, b) => {
    const aInterests = a.profile_domains.map((pd) => pd.domains?.name ?? "");
    const bInterests = b.profile_domains.map((pd) => pd.domains?.name ?? "");

    const overlap =
      interestOverlap(queryInterests, bInterests) -
      interestOverlap(queryInterests, aInterests);
    if (overlap !== 0) return overlap;

    const recency =
      recencyBucket(b.github_cache?.commits_90d) -
      recencyBucket(a.github_cache?.commits_90d);
    if (recency !== 0) return recency;

    return (b.codeforces_cache?.rating ?? 0) - (a.codeforces_cache?.rating ?? 0);
  });

  // ── Shape the response — raw evidence only, no scores (Rule 3) ────────────
  const results: DiscoverResult[] = sorted.map((p) => ({
    id: p.id,
    name: p.full_name,
    year: p.year,
    department: p.department,
    current_project: p.current_project,
    looking_for: p.looking_for,
    bio: p.bio,
    interests: p.profile_domains.map((pd) => pd.domains?.name ?? "").filter(Boolean),
    github: p.github_cache
      ? {
          languages: p.github_cache.languages ?? {},
          commits_90d: p.github_cache.commits_90d ?? 0,
        }
      : null,
    codeforces: p.codeforces_cache
      ? {
          rating: p.codeforces_cache.rating ?? 0,
          rank: p.codeforces_cache.rank_title ?? "unrated",
        }
      : null,
  }));

  return NextResponse.json({ results, count: results.length });
}
