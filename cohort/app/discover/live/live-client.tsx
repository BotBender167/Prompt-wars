"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock } from "lucide-react";
import { JoinLocationModal } from "./join-location-modal";

const LOCATIONS = [
  "Library",
  "Cafeteria",
  "ECE Lab",
  "Maker Space",
  "Seminar Room",
  "Outdoor Quad",
];

interface BeaconProfile {
  name: string;
  year: number | null;
  current_project: string | null;
  bio: string | null;
  interests: string[];
}

interface Beacon {
  id: string;
  profile_id: string;
  location_name: string;
  available_until: string;
  created_at: string;
  member_count: number | string;
  profile?: BeaconProfile;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

function getMinutesLeft(until: string) {
  const diff = new Date(until).getTime() - Date.now();
  const mins = Math.floor(diff / 60000);
  return mins > 0 ? mins : 0;
}

export function LiveClient() {
  const [selectedLocation, setSelectedLocation] = useState<string>(LOCATIONS[0]);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const fetchBeacons = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/beacons");
      if (!res.ok) throw new Error("Failed to load who is active.");
      const data = await res.json();
      setBeacons(data.beacons || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load who is active.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeacons();
  }, [fetchBeacons]);

  const locationBeacons = beacons.filter((b) => b.location_name === selectedLocation);

  // The API returns either an exact count or the "A few members" privacy label
  // when fewer than three people are present, so the label carries its own noun.
  const rawCount = locationBeacons.length > 0 ? locationBeacons[0].member_count : 0;
  const countLabel =
    typeof rawCount === "number"
      ? `${rawCount} active ${rawCount === 1 ? "member" : "members"}`
      : `${rawCount} active`;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Locations */}
      <aside className="w-full md:w-64 shrink-0 space-y-4">
        <h3 className="text-sm font-semibold mb-4">Locations</h3>
        <div className="flex flex-col gap-2">
          {LOCATIONS.map((loc) => {
            const isActive = loc === selectedLocation;
            return (
              <Button
                key={loc}
                variant={isActive ? "default" : "ghost"}
                className={`justify-start ${!isActive && "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                onClick={() => setSelectedLocation(loc)}
              >
                <MapPin className="mr-2 h-4 w-4" />
                {loc}
              </Button>
            );
          })}
        </div>
        <div className="pt-4">
          <Button className="w-full" variant="outline" onClick={() => setIsJoinModalOpen(true)}>
            Join a location
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {selectedLocation}
          </h2>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {countLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </Card>
            ))
          ) : error ? (
            <div className="col-span-full py-12 text-center text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="mb-4">{error}</p>
              <Button
                onClick={fetchBeacons}
                variant="outline"
                className="border-destructive/50 hover:bg-destructive/20 text-destructive"
              >
                Retry
              </Button>
            </div>
          ) : locationBeacons.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
              <p>Nobody is currently active at {selectedLocation}.</p>
            </div>
          ) : (
            locationBeacons.map((beacon) => (
              <Card key={beacon.id} className="p-6 flex flex-col border-border/50 shadow-sm hover:border-border transition-colors bg-card group relative">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 bg-primary/10 border border-primary/20">
                    <AvatarFallback className="text-primary font-medium bg-transparent">
                      {getInitials(beacon.profile?.name ?? "Unknown")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground leading-none mb-1.5">
                      {beacon.profile?.name ?? "Unknown"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {beacon.profile?.year ? `Year ${beacon.profile.year}` : "Student"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {beacon.profile?.current_project && (
                    <p className="text-sm text-foreground line-clamp-2">
                      <span className="font-medium text-muted-foreground">Currently:</span>{" "}
                      {beacon.profile.current_project}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-md w-fit">
                    <Clock className="h-3.5 w-3.5" />
                    Available now &middot; {getMinutesLeft(beacon.available_until)}min left
                  </div>
                </div>
                
                {/* Hover Reveal: Bio & Interests */}
                <div className="absolute inset-0 bg-card p-6 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center rounded-xl overflow-hidden border border-border shadow-md z-10 pointer-events-none">
                  {beacon.profile?.bio && (
                    <p className="text-sm text-foreground mb-3 italic">&quot;{beacon.profile.bio}&quot;</p>
                  )}
                  {beacon.profile?.interests && beacon.profile.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {beacon.profile.interests.map((int, i) => (
                        <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-sm">
                          {int}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      
      <JoinLocationModal 
        isOpen={isJoinModalOpen} 
        onClose={() => setIsJoinModalOpen(false)}
        locations={LOCATIONS}
        onJoined={fetchBeacons}
      />
    </div>
  );
}
