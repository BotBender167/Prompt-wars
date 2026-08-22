import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { guardApiRequest } from "@/lib/api-security";
import { getAuthenticatedProfileId } from "@/lib/session";
import { isUuid } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/beacons/[id]
 *
 * Removes a beacon. The request body identifies the expected owner and the
 * HttpOnly profile session proves ownership before deletion.
 *
 * Only the owning profile may delete its own beacon.
 */
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const guarded = guardApiRequest(req, { limit: 20, requireSameOrigin: true });
  if (guarded) return guarded;

  const { id } = await params;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Beacon id must be a valid UUID" }, { status: 400 });
  }

  // The body id is an assertion; the server session is the authority.
  let profile_id: string | undefined;
  try {
    const body = (await req.json()) as { profile_id?: string };
    profile_id = body.profile_id;
  } catch {
    // body is optional — if unparseable, we still attempt the delete but
    // ownership check will fail gracefully.
  }

  if (!isUuid(profile_id)) {
    return NextResponse.json(
      { error: "profile_id must be a valid UUID" },
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

  // First verify ownership
  const { data: beacon, error: fetchError } = await supabase
    .from("beacons")
    .select("id, profile_id")
    .eq("id", id)
    .single();

  if (fetchError || !beacon) {
    return NextResponse.json({ error: "Beacon not found" }, { status: 404 });
  }

  if (beacon.profile_id !== profile_id) {
    return NextResponse.json(
      { error: "Forbidden: you do not own this beacon" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("beacons")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Failed to delete beacon", deleteError);
    return NextResponse.json({ error: "Failed to delete beacon" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, id });
}
