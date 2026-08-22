import { createServerClient } from "@/lib/supabase/server";
import { HeroSearch } from "./hero-search";

export async function HeroSection() {
  const supabase = createServerClient();
  const { data: domains } = await supabase
    .from("domains")
    .select("name")
    .order("name");

  // No placeholder pills when this comes back empty: every name here is sent to
  // /discover as an `interests` filter, so an invented one silently matches
  // nothing. An empty row set means the domains table is unreachable or unseeded
  // — HeroSearch renders that state instead of hiding it.
  const displayDomains = domains ?? [];

  return (
    <div className="relative overflow-hidden bg-background pt-[120px] pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Discover your Thapar Parivar.
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            Find peers, mentors, and collaborators around your Thapar campus, right now.
          </p>
          <p className="text-sm font-medium text-muted-foreground/80 mb-10 uppercase tracking-widest">
            For Thapar students only
          </p>

          <HeroSearch domains={displayDomains} />
        </div>

        <div className="mt-20 relative mx-auto max-w-5xl">
          <div className="aspect-[16/9] rounded-xl overflow-hidden border border-border bg-card/50 backdrop-blur-sm relative shadow-[0_0_50px_rgba(42,27,77,0.5)] flex items-center justify-center">
            <svg viewBox="0 0 800 450" className="w-full h-full text-primary" aria-label="Constellation representing campus network">
              {/* Background stars / nodes */}
              <circle cx="200" cy="150" r="3" className="fill-primary/40" />
              <circle cx="350" cy="100" r="4" className="fill-primary/60" />
              <circle cx="500" cy="200" r="5" className="fill-primary" />
              <circle cx="650" cy="120" r="3" className="fill-primary/40" />
              <circle cx="450" cy="300" r="4" className="fill-primary/80" />
              <circle cx="600" cy="350" r="3" className="fill-primary/50" />
              
              {/* Connecting lines */}
              <line x1="200" y1="150" x2="350" y2="100" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
              <line x1="350" y1="100" x2="500" y2="200" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
              <line x1="500" y1="200" x2="650" y2="120" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
              <line x1="500" y1="200" x2="450" y2="300" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
              <line x1="450" y1="300" x2="600" y2="350" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
              <line x1="350" y1="100" x2="450" y2="300" stroke="currentColor" strokeWidth="1" strokeOpacity="0.1" />

              {/* Silhouette figure looking up */}
              <path 
                d="M100 450 Q100 380 140 340 Q160 320 160 290 Q160 260 140 240 Q120 220 120 190 Q120 160 145 145 Q170 130 200 140 Q215 145 225 160 L240 190 Q245 200 240 210 L220 250 Q210 270 200 280 L180 300 Q160 320 160 350 L160 450 Z" 
                className="fill-secondary drop-shadow-md"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
