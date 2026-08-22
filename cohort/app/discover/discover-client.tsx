"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Code, Flame, Bookmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfileId } from "@/lib/profile-id";

interface DiscoverResult {
  id: string;
  name: string;
  year: number | null;
  department: string | null;
  current_project: string | null;
  looking_for: string | null;
  bio: string | null;
  interests: string[];
  github: {
    languages: Record<string, number>;
    commits_90d: number;
  } | null;
  codeforces: {
    rating: number;
    rank: string;
  } | null;
}

interface DiscoverClientProps {
  domains: string[];
  departments: string[];
}

interface DraftState {
  target: DiscoverResult;
  text: string | null;
  error: string | null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export function DiscoverClient({ domains, departments }: DiscoverClientProps) {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() =>
    searchParams.getAll("interests")
  );
  const [selectedDept, setSelectedDept] = useState<string>("");

  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);

  // Guards against a slower earlier response overwriting a newer one when
  // filters are toggled quickly.
  const requestIdRef = useRef(0);

  const fetchResults = useCallback(
    async (q: string, dept: string, interests: string[]) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, department: dept, interests }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Failed to fetch results");

        const data = await res.json();
        if (requestId !== requestIdRef.current) return;
        setResults(data.results || []);
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        if (err instanceof Error && err.name === "AbortError") {
          setError("Request timed out. Please try again.");
        } else {
          setError("An error occurred while fetching results.");
        }
      } finally {
        clearTimeout(timeoutId);
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchResults("", "", searchParams.getAll("interests"));
    // Mount-only: every later fetch is driven by the filter handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults(query, selectedDept, selectedInterests);
  };

  // Filter changes refetch immediately. Previously they only mutated state, so
  // clicking an interest or changing department appeared to do nothing at all.
  const toggleInterest = (domain: string) => {
    const next = selectedInterests.includes(domain)
      ? selectedInterests.filter((d) => d !== domain)
      : [...selectedInterests, domain];
    setSelectedInterests(next);
    fetchResults(query, selectedDept, next);
  };

  const handleDeptChange = (dept: string) => {
    setSelectedDept(dept);
    fetchResults(query, dept, selectedInterests);
  };

  const handleMessage = async (profile: DiscoverResult) => {
    const searcherId = getProfileId();
    if (!searcherId) {
      setDraft({
        target: profile,
        text: null,
        error:
          "Set up your own profile first — the draft is written from what you are building and looking for.",
      });
      return;
    }

    setDraft({ target: profile, text: null, error: null });

    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_profile_id: profile.id,
          searcher_profile_id: searcherId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not draft a message.");
      }

      const { message } = await res.json();
      setDraft({ target: profile, text: message, error: null });
    } catch (err) {
      setDraft({
        target: profile,
        text: null,
        error: err instanceof Error ? err.message : "Could not draft a message.",
      });
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 shrink-0 space-y-8">
        <div>
          <label htmlFor="dept-filter" className="text-sm font-semibold mb-4 block">
            Department
          </label>
          <select
            id="dept-filter"
            className="w-full p-2 border border-border rounded-md bg-background text-sm"
            value={selectedDept}
            onChange={(e) => handleDeptChange(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-4">Interests</h3>
          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Interest tags are unavailable right now.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {domains.map((domain) => {
                const isSelected = selectedInterests.includes(domain);
                return (
                  <Badge
                    key={domain}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    variant={isSelected ? "default" : "secondary"}
                    className="cursor-pointer font-normal"
                    onClick={() => toggleInterest(domain)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleInterest(domain);
                      }
                    }}
                  >
                    {domain}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search people"
              placeholder="Search by interest, project, name..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-px w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </Card>
            ))
          ) : error ? (
            <div className="col-span-full py-12 text-center text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="mb-4">{error}</p>
              <Button
                onClick={() => fetchResults(query, selectedDept, selectedInterests)}
                variant="outline"
                className="border-destructive/50 hover:bg-destructive/20 text-destructive"
              >
                Retry
              </Button>
            </div>
          ) : results.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
              <p>No members found. Adjust your filters.</p>
            </div>
          ) : (
            results.map((profile) => (
              <Card
                key={profile.id}
                className="p-6 flex flex-col border-border/50 shadow-sm hover:border-border transition-colors bg-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 bg-primary/10 border border-primary/20">
                      <AvatarFallback className="text-primary font-medium bg-transparent">
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground leading-none mb-1.5">
                        {profile.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {profile.year ? `Year ${profile.year} · ` : ""}
                        {profile.department ?? "Student"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleMessage(profile)}
                  >
                    Message
                  </Button>
                </div>

                <div className="mt-5 space-y-2 flex-1">
                  {profile.current_project && (
                    <p className="text-sm text-foreground">
                      <span className="font-medium text-muted-foreground">Currently:</span>{" "}
                      {profile.current_project}
                    </p>
                  )}
                  {profile.looking_for && (
                    <p className="text-sm text-foreground">
                      <span className="font-medium text-muted-foreground">Looking for:</span>{" "}
                      {profile.looking_for}
                    </p>
                  )}
                </div>

                <hr className="my-5 border-border" />

                <div className="space-y-2.5">
                  {profile.github && profile.github.commits_90d > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Code className="h-4 w-4 shrink-0 text-foreground/70" />
                      <span>
                        {profile.github.commits_90d} repos pushed, 90d
                        {Object.keys(profile.github.languages).length > 0 &&
                          ` · ${Object.keys(profile.github.languages).slice(0, 3).join(", ")}`}
                      </span>
                    </div>
                  )}
                  {profile.codeforces && profile.codeforces.rating > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Flame className="h-4 w-4 shrink-0 text-orange-500/80" />
                      <span>
                        Codeforces {profile.codeforces.rating} · {profile.codeforces.rank}
                      </span>
                    </div>
                  )}
                  {profile.interests.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Bookmark className="h-4 w-4 shrink-0 text-foreground/70 mt-0.5" />
                      <span className="leading-snug">
                        Interests: {profile.interests.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {draft && <MessageDraftDialog draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function MessageDraftDialog({
  draft,
  onClose,
}: {
  draft: DraftState;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!draft.text) return;
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Message to ${draft.target.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-md p-6 rounded-xl border border-border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          Message {draft.target.name}
        </h2>

        {draft.error ? (
          <p className="text-sm text-destructive">{draft.error}</p>
        ) : draft.text === null ? (
          <p className="text-sm text-muted-foreground">Drafting…</p>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/40 border border-border rounded-md p-3">
            {draft.text}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {draft.text && <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>}
        </div>
      </div>
    </div>
  );
}
