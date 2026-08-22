/**
 * GitHub provider — Rule 4 compliant.
 * All GitHub API calls for this project live exclusively in this file.
 *
 * Env vars:
 *   GITHUB_TOKEN (optional) — raises the unauthenticated rate-limit from 60 to 5 000 req/hr
 */

export interface GitHubData {
  languages: Record<string, number>;
  public_repos: number;
  commits_90d: number;
}

export interface GitHubResult {
  data: GitHubData | null;
  error: string | null;
}

interface GitHubRepo {
  language: string | null;
  pushed_at: string | null;
  fork: boolean;
}

/** Build Authorization header only when a token is configured (Rule 6). */
function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch a user's GitHub profile data.
 * Returns { data, error } — never throws (Rule 5).
 */
export async function fetchGitHubProfile(
  username: string
): Promise<GitHubResult> {
  if (!username || !username.trim()) {
    return { data: null, error: "username is required" };
  }

  const handle = username.trim();
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...authHeaders(),
  };

  try {
    // ── 1. User profile (for public_repos count) ────────────────────────────
    const userRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(handle)}`,
      { headers, next: { revalidate: 3600 } }
    );

    if (userRes.status === 404) {
      return { data: null, error: "GitHub user not found" };
    }
    if (!userRes.ok) {
      return {
        data: null,
        error: `GitHub API error: ${userRes.status} ${userRes.statusText}`,
      };
    }

    const userJson = await userRes.json();
    const public_repos: number = userJson.public_repos ?? 0;

    // ── 2. Repository list (for language map + recency proxy) ───────────────
    const reposRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(handle)}/repos?per_page=100&sort=pushed`,
      { headers, next: { revalidate: 3600 } }
    );

    if (!reposRes.ok) {
      return {
        data: null,
        error: `GitHub repos API error: ${reposRes.status} ${reposRes.statusText}`,
      };
    }

    const repos: GitHubRepo[] = await reposRes.json();

    // ── 3. Derive language frequency map ────────────────────────────────────
    const languages: Record<string, number> = {};
    for (const repo of repos) {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] ?? 0) + 1;
      }
    }

    // ── 4. commits_90d — repos pushed within the last 90 days (proxy) ───────
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const commits_90d = repos.filter((repo) => {
      if (!repo.pushed_at) return false;
      return new Date(repo.pushed_at).getTime() >= cutoff;
    }).length;

    return {
      data: { languages, public_repos, commits_90d },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: `fetchGitHubProfile failed: ${message}` };
  }
}
