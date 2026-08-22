import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface RouteParams {
  params: { id: string };
}

/**
 * DELETE /api/beacons/[id]
 *
 * Removes a beacon. The request body must include the profile_id of the
 * requester so we can verify ownership before deletion.
 *
 * Only the owning profile may delete its own beacon.
 */
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Beacon id is required" }, { status: 400 });
  }

  // Ownership check: the caller supplies their profile_id in the body.
  // Phase 3 will replace this with a proper auth session check.
  let profile_id: string | undefined;
  try {
    const body = (await req.json()) as { profile_id?: string };
    profile_id = body.profile_id;
  } catch {
    // body is optional — if unparseable, we still attempt the delete but
    // ownership check will fail gracefully.
  }

  if (!profile_id) {
    return NextResponse.json(
      { error: "profile_id is required to verify ownership" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

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
    return NextResponse.json(
      { error: `Failed to delete beacon: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true, id });
}
