"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeroSearchProps {
  domains: { name: string }[];
}

export function HeroSearch({ domains }: HeroSearchProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleInterest = (domain: string) => {
    setSelected((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    selected.forEach((s) => params.append("interests", s));
    const query = params.toString();
    router.push(query ? `/discover?${query}` : "/discover");
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6 mt-8">
      {domains.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {domains.map((domain) => {
            const isSelected = selected.includes(domain.name);
            return (
              <Badge
                key={domain.name}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                variant={isSelected ? "default" : "secondary"}
                className="cursor-pointer text-sm py-1.5 px-3 transition-colors"
                onClick={() => toggleInterest(domain.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleInterest(domain.name);
                  }
                }}
              >
                {domain.name}
              </Badge>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Interest tags are unavailable right now. You can still browse everyone.
        </p>
      )}

      <Button size="lg" onClick={handleSearch} className="px-8 h-12 text-base">
        Start discovering
      </Button>
    </div>
  );
}
