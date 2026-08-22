import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProfileId } from "@/lib/profile-id";

interface JoinLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: string[];
  onJoined: () => void;
}

export function JoinLocationModal({
  isOpen,
  onClose,
  locations,
  onJoined,
}: JoinLocationModalProps) {
  const [selectedLoc, setSelectedLoc] = useState(locations[0]);
  const [minutes, setMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Previously this posted an all-zeros placeholder UUID, so the insert
    // always failed the foreign key and the modal closed as if it had worked.
    const profileId = getProfileId();
    if (!profileId) {
      setError("needs-profile");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/beacons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          location_name: selectedLoc,
          available_minutes: Number(minutes),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not join this location.");
      }

      onJoined();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this location.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Join a location"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <div className="bg-card w-full max-w-md p-6 rounded-xl border border-border shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Join a location</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="join-location" className="block text-sm font-medium mb-1">
              Location
            </label>
            <select
              id="join-location"
              className="w-full p-2 border border-border rounded-md bg-background text-sm"
              value={selectedLoc}
              onChange={(e) => setSelectedLoc(e.target.value)}
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="join-minutes" className="block text-sm font-medium mb-1">
              Available for (minutes)
            </label>
            <Input
              id="join-minutes"
              type="number"
              min="1"
              max="1440"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </div>

          {error === "needs-profile" ? (
            <p role="alert" className="text-sm text-destructive">
              You need a profile before going live.{" "}
              <Link href="/parivar" className="underline font-medium">
                Set one up
              </Link>
              .
            </p>
          ) : (
            error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Joining..." : "Join"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
