import { LiveClient } from "./live-client";

export default function LivePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Live Now</h1>
        <p className="text-muted-foreground">
          See who is currently active around Thapar campus.
        </p>
      </div>
      <LiveClient />
    </div>
  );
}
