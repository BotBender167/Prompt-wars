import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { DEPARTMENTS } from "@/lib/campus";
import { DiscoverClient } from "./discover-client";

// The domain taxonomy changes rarely, so serve it from the ISR cache instead of
// hitting Supabase per request. Results themselves come from /api/discover.
export const revalidate = 3600;

export default async function DiscoverPage() {
  const supabase = createServerClient();
  const { data: domains } = await supabase
    .from("domains")
    .select("name")
    .order("name");

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Discover</h1>
        <p className="text-muted-foreground">
          Find peers and collaborators on campus.
        </p>
      </div>
      <Suspense fallback={<div>Loading discover...</div>}>
        <DiscoverClient
          domains={domains?.map((d) => d.name) ?? []}
          departments={DEPARTMENTS}
        />
      </Suspense>
    </div>
  );
}
