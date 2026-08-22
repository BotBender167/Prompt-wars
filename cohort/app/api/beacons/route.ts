import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { INSTITUTION_NAME } from "@/lib/campus";
import { guardApiRequest } from "@/lib/api-security";
import { getAuthenticatedProfileId } from "@/lib/session";
import { isUuid, nullableText, parsePositiveInteger } from "@/lib/validation";

// ── Privacy threshold ──────────────────────────────────────────────────────
// If fewer than 3 people are at a location, the API must NOT reveal the real
// count. This is enforced here in the server response, not just the UI.
const MIN_VISIBLE_COUNT = 3;
const FEW_MEMBERS_LABEL = "A few members";

// ── GET — list active beacons (available_until > now) ─────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guarded = guardApiRequest(req, { limit: 120 });
  if (guarded) return guarded;

  const supabase = createServerClient();

  const { data: beacons, error } = await supabase
    .from("beacons")
    .select(
      `id, profile_id, location_name, available_until, created_at, 
       profiles!inner ( 
         full_name, year, current_project, bio, 
         profile_domains ( domains ( name ) ),
         institutions!inner ( name ) 
       )`
    )
    .gt("available_until", new Date().toISOString())
    .eq("profiles.institutions.name", INSTITUTION_NAME)
    .order("available_until", { ascending: true });

  if (error) {
    console.error("Failed to load beacons", error);
    return NextResponse.json({ error: "Failed to load beacons" }, { status: 500 });
  }

  // Group by location to apply presence anonymisation
  const locationGroups = new Map<string, typeof beacons>();
  for (const beacon of beacons ?? []) {
    const loc = beacon.location_name;
    if (!locationGroups.has(loc)) locationGroups.set(loc, []);
    locationGroups.get(loc)!.push(beacon);
  }

  // Build anonymised list — hide count when < MIN_VISIBLE_COUNT
  const result = (beacons ?? []).map((beacon) => {
    const groupSize = locationGroups.get(beacon.location_name)?.length ?? 0;
    const bProfile = (beacon as unknown as {
      profiles: {
        full_name: string | null;
        year: number | null;
        current_project: string | null;
        bio: string | null;
        profile_domains: { domains: { name: string } | null }[];
      } | null;
    }).profiles;

    return {
      id: beacon.id,
      profile_id: beacon.profile_id,
      location_name: beacon.location_name,
      available_until: beacon.available_until,
      created_at: beacon.created_at,
      // headcount is anonymised below threshold — never expose exact count < 3
      member_count:
        groupSize >= MIN_VISIBLE_COUNT ? groupSize : FEW_MEMBERS_LABEL,
      profile: {
        name: bProfile?.full_name ?? "Unknown",
        year: bProfile?.year,
        current_project: bProfile?.current_project,
        bio: bProfile?.bio,
        interests: (bProfile?.profile_domains ?? []).map((pd) => pd.domains?.name).filter(Boolean),
      }
    };
  });

  return NextResponse.json({ beacons: result, count: result.length });
}

// ── POST — create a beacon ─────────────────────────────────────────────────

interface CreateBeaconBody {
  profile_id: string;
  location_name: string;
  available_minutes: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guarded = guardApiRequest(req, { limit: 20, requireSameOrigin: true });
  if (guarded) return guarded;

  let body: CreateBeaconBody;
  try {
    body = (await req.json()) as CreateBeaconBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { profile_id } = body;
  const location_name = nullableText(body.location_name, 120);
  const available_minutes = parsePositiveInteger(body.available_minutes, 1440);

  if (!isUuid(profile_id)) {
    return NextResponse.json(
      { error: "profile_id must be a valid UUID" },
      { status: 400 }
    );
  }
  if (!location_name) {
    return NextResponse.json(
      { error: "location_name is required" },
      { status: 400 }
    );
  }
  if (!available_minutes) {
    return NextResponse.json(
      { error: "available_minutes must be a positive integer ≤ 1440 (24h)" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const authenticatedProfileId = await getAuthenticatedProfileId(req, supabase);
  if (!authenticatedProfileId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (authenticatedProfileId !== profile_id) {
    return NextResponse.json({ error: "Forbidden profile" }, { status: 403 });
  }

  // Compute available_until server-side — clients never supply this (Rule 6 spirit)
  const available_until = new Date(
    Date.now() + available_minutes * 60 * 1000
  ).toISOString();

  const { data: beacon, error } = await supabase
    .from("beacons")
    .insert({
      profile_id,
      location_name,
      available_until,
    })
    .select("id, profile_id, location_name, available_until, created_at")
    .single();

  if (error) {
    console.error("Failed to create beacon", error);
    return NextResponse.json({ error: "Failed to create beacon" }, { status: 500 });
  }

  return NextResponse.json({ beacon }, { status: 201 });
}
