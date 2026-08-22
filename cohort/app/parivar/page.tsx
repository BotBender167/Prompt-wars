import { createServerClient } from "@/lib/supabase/server";
import { DEPARTMENTS } from "@/lib/campus";
import { ParivarClient } from "./parivar-client";

// The domain taxonomy changes rarely, so serve it from the ISR cache instead of
// hitting Supabase per request.
export const revalidate = 3600;

export default async function ParivarPage() {
  const supabase = createServerClient();
  const { data: domains } = await supabase
    .from("domains")
    .select("name")
    .order("name");

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Your Parivar</h1>
        <p className="text-muted-foreground">
          Manage your profile and connected accounts.
        </p>
      </div>
      <ParivarClient
        domains={domains?.map((d) => d.name) ?? []}
        departments={DEPARTMENTS}
      />
    </div>
  );
}
