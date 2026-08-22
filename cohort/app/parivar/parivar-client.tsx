"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Flame, RefreshCw } from "lucide-react";
import { getProfileId, setProfileId } from "@/lib/profile-id";
import { INSTITUTION_NAME } from "@/lib/campus";

interface ParivarClientProps {
  domains: string[];
  departments: string[];
}

interface LoadedProfile {
  id: string;
  full_name: string | null;
  year: number | null;
  department: string | null;
  current_project: string | null;
  looking_for: string | null;
  interests: string[];
  github_username: string | null;
  codeforces_handle: string | null;
  github_cache: {
    languages: Record<string, number> | null;
    commits_90d: number | null;
    public_repos: number | null;
    synced_at: string | null;
  } | null;
  codeforces_cache: {
    rating: number | null;
    rank_title: string | null;
    problems_solved: number | null;
    synced_at: string | null;
  } | null;
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

function formatSynced(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function readError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind !== "ok" && status.kind !== "error") return null;
  return (
    <p
      role="status"
      className={`text-sm ${status.kind === "error" ? "text-destructive" : "text-emerald-600 dark:text-emerald-500"}`}
    >
      {status.text}
    </p>
  );
}

export function ParivarClient({ domains, departments }: ParivarClientProps) {
  const [profileId, setId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [department, setDepartment] = useState("");
  const [currentProject, setCurrentProject] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<Status>({ kind: "idle" });

  const [ghHandle, setGhHandle] = useState("");
  const [cfHandle, setCfHandle] = useState("");
  const [connectStatus, setConnectStatus] = useState<Status>({ kind: "idle" });

  const [activity, setActivity] = useState<LoadedProfile | null>(null);

  const applyProfile = useCallback((p: LoadedProfile) => {
    setActivity(p);
    setFullName(p.full_name ?? "");
    setYear(p.year ?? "");
    setDepartment(p.department ?? "");
    setCurrentProject(p.current_project ?? "");
    setLookingFor(p.looking_for ?? "");
    setSelectedInterests(p.interests ?? []);
    setGhHandle(p.github_username ?? "");
    setCfHandle(p.codeforces_handle ?? "");
  }, []);

  const loadProfile = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/profile?id=${encodeURIComponent(id)}`);
        if (res.ok) {
          const { profile } = await res.json();
          applyProfile(profile as LoadedProfile);
        }
      } catch {
        // A failed reload leaves the form empty — the user can still save,
        // which is better than blocking the whole tab on a network blip.
      }
    },
    [applyProfile]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStoredProfile() {
      await Promise.resolve();
      if (cancelled) return;

      const stored = getProfileId();
      setId(stored);
      if (stored) {
        await loadProfile(stored);
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void loadStoredProfile();

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const toggleInterest = (domain: string) => {
    setSelectedInterests((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  /** Single writer for the profile row — the save form and both connect cards share it. */
  const saveProfile = async (
    overrides: Partial<{ github_username: string | null; codeforces_handle: string | null }> = {}
  ): Promise<string | null> => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: profileId,
        full_name: fullName,
        year: year === "" ? null : year,
        department,
        current_project: currentProject,
        looking_for: lookingFor,
        interests: selectedInterests,
        github_username: ghHandle,
        codeforces_handle: cfHandle,
        ...overrides,
      }),
    });

    if (!res.ok) throw new Error(await readError(res, "Failed to save profile"));

    const { id } = await res.json();
    if (id !== profileId) {
      setProfileId(id);
      setId(id);
    }
    return id as string;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus({ kind: "busy" });
    try {
      await saveProfile();
      setSaveStatus({ kind: "ok", text: "Profile saved." });
    } catch (err) {
      setSaveStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to save profile.",
      });
    }
  };

  /** Persist whatever handles are in the form, then pull fresh evidence for both providers. */
  const syncAccounts = async (
    overrides?: Partial<{ github_username: string | null; codeforces_handle: string | null }>
  ) => {
    setConnectStatus({ kind: "busy" });
    try {
      if (!fullName.trim()) {
        setConnectStatus({
          kind: "error",
          text: "Add your name on the Profile tab first — a profile is needed to attach accounts to.",
        });
        return;
      }

      const id = await saveProfile(overrides);
      if (!id) return;

      const res = await fetch(`/api/sync/${encodeURIComponent(id)}`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Sync failed"));

      const result = await res.json();
      await loadProfile(id);

      const failed = [
        ghHandle.trim() && result.github_status !== "ok" ? "GitHub" : null,
        cfHandle.trim() && result.codeforces_status !== "ok" ? "Codeforces" : null,
      ].filter(Boolean);

      setConnectStatus(
        failed.length > 0
          ? {
              kind: "error",
              text: `Could not sync ${failed.join(" or ")} — check the handle is spelled correctly and is public.`,
            }
          : { kind: "ok", text: "Synced." }
      );
    } catch (err) {
      setConnectStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Sync failed.",
      });
    }
  };

  const isBusy = saveStatus.kind === "busy";
  const isSyncing = connectStatus.kind === "busy";
  const gh = activity?.github_cache;
  const cf = activity?.codeforces_cache;
  const ghLanguages = Object.entries(gh?.languages ?? {}).sort((a, b) => b[1] - a[1]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your profile…</p>;
  }

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="mb-6 w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
        <TabsTrigger
          value="profile"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
        >
          Profile
        </TabsTrigger>
        <TabsTrigger
          value="connect"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
        >
          Connect
        </TabsTrigger>
        <TabsTrigger
          value="activity"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
        >
          Activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-6 outline-none">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Institution</CardTitle>
            <CardDescription className="text-foreground font-medium">
              {INSTITUTION_NAME}
            </CardDescription>
          </CardHeader>
        </Card>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="full-name" className="text-sm font-medium">
                    Full Name
                  </label>
                  <Input
                    id="full-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="year" className="text-sm font-medium">
                    Year
                  </label>
                  <Input
                    id="year"
                    type="number"
                    min="1"
                    max="5"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value) || "")}
                    placeholder="1-5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="department" className="text-sm font-medium">
                  Department
                </label>
                <select
                  id="department"
                  className="w-full p-2 border border-border rounded-md bg-background text-sm"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">Select your department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="current-project" className="text-sm font-medium">
                  Currently Building
                </label>
                <Textarea
                  id="current-project"
                  value={currentProject}
                  onChange={(e) => setCurrentProject(e.target.value)}
                  placeholder="What are you building?"
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="looking-for" className="text-sm font-medium">
                  Looking For
                </label>
                <Textarea
                  id="looking-for"
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  placeholder="What do you need? Role, skill, or collaborator type."
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium block mb-2">Interests</span>
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
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end items-center gap-4">
            <StatusLine status={saveStatus} />
            <Button type="submit" disabled={isBusy}>
              {isBusy ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="connect" className="space-y-6 outline-none">
        <div className="flex justify-end items-center gap-4">
          <StatusLine status={connectStatus} />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => syncAccounts()}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync now"}
          </Button>
        </div>

        <div className="grid gap-4">
          <Card className="border-border shadow-sm flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
            <div className="flex items-center gap-4 text-left w-full sm:w-auto">
              <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center shrink-0">
                <Code className="h-5 w-5 text-foreground/70" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">GitHub</h3>
                <p className="text-sm text-muted-foreground">
                  Showcase your commits and languages
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  syncAccounts();
                }}
                className="flex gap-2 w-full sm:w-auto"
              >
                <Input
                  aria-label="GitHub username"
                  placeholder="Enter username"
                  value={ghHandle}
                  onChange={(e) => setGhHandle(e.target.value)}
                  className="w-full sm:w-40"
                />
                <Button type="submit" disabled={isSyncing}>
                  {activity?.github_username ? "Update" : "Connect"}
                </Button>
              </form>
              <span className="text-xs text-muted-foreground shrink-0">
                Last synced: {formatSynced(gh?.synced_at)}
              </span>
            </div>
          </Card>

          <Card className="border-border shadow-sm flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
            <div className="flex items-center gap-4 text-left w-full sm:w-auto">
              <div className="h-10 w-10 bg-orange-50 dark:bg-orange-950/30 rounded-full flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Codeforces</h3>
                <p className="text-sm text-muted-foreground">
                  Verify your algorithmic problem solving
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  syncAccounts();
                }}
                className="flex gap-2 w-full sm:w-auto"
              >
                <Input
                  aria-label="Codeforces handle"
                  placeholder="Enter handle"
                  value={cfHandle}
                  onChange={(e) => setCfHandle(e.target.value)}
                  className="w-full sm:w-40"
                />
                <Button type="submit" variant="secondary" disabled={isSyncing}>
                  Sync
                </Button>
              </form>
              <span className="text-xs text-muted-foreground shrink-0">
                Last synced: {formatSynced(cf?.synced_at)}
              </span>
            </div>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="activity" className="space-y-6 outline-none">
        {!gh && !cf ? (
          <div className="py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
            <p>Nothing synced yet. Connect an account on the Connect tab.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {gh && (
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    GitHub
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    {gh.commits_90d ?? 0} repositories pushed in the last 90 days
                  </p>
                  {ghLanguages.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Languages:{" "}
                      {ghLanguages.map(([lang, count]) => `${lang} (${count})`).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/60 pt-2 border-t mt-4">
                    Last synced: {formatSynced(gh.synced_at)}
                  </p>
                </CardContent>
              </Card>
            )}

            {cf && (
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Codeforces
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Rank: {cf.rank_title ?? "unrated"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Problems solved: {cf.problems_solved ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground/60 pt-2 border-t mt-4">
                    Last synced: {formatSynced(cf.synced_at)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
