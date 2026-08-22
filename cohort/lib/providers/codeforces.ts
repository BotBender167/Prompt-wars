/**
 * Codeforces provider — Rule 4 compliant.
 * All Codeforces API calls for this project live exclusively in this file.
 * Codeforces is a public API; no authentication is required.
 */

export interface CodeforcesData {
  rating: number;
  maxRating: number;
  rank: string;
  problemsSolved: number;
}

export interface CodeforcesResult {
  data: CodeforcesData | null;
  error: string | null;
}

interface CFUserInfo {
  status: string;
  result?: Array<{
    rating?: number;
    maxRating?: number;
    rank?: string;
  }>;
  comment?: string;
}

interface CFStatusResponse {
  status: string;
  result?: Array<{
    verdict?: string;
    problem?: { contestId?: number; index?: string };
  }>;
  comment?: string;
}

/**
 * Fetch a user's Codeforces profile.
 * Returns { data, error } — never throws (Rule 5).
 */
export async function fetchCodeforcesProfile(
  handle: string
): Promise<CodeforcesResult> {
  if (!handle || !handle.trim()) {
    return { data: null, error: "handle is required" };
  }

  const h = encodeURIComponent(handle.trim());

  try {
    // ── 1. User info ────────────────────────────────────────────────────────
    const infoRes = await fetch(
      `https://codeforces.com/api/user.info?handles=${h}`,
      { next: { revalidate: 3600 } }
    );

    if (!infoRes.ok) {
      return {
        data: null,
        error: `Codeforces API error: ${infoRes.status} ${infoRes.statusText}`,
      };
    }

    const infoJson: CFUserInfo = await infoRes.json();

    if (infoJson.status === "FAILED") {
      return { data: null, error: "handle not found" };
    }

    const user = infoJson.result?.[0];
    if (!user) {
      return { data: null, error: "handle not found" };
    }

    const rating = user.rating ?? 0;
    const maxRating = user.maxRating ?? 0;
    const rank = user.rank ?? "unrated";

    // ── 2. Submission list — count unique solved problems ───────────────────
    const statusRes = await fetch(
      `https://codeforces.com/api/user.status?handle=${h}`,
      { next: { revalidate: 3600 } }
    );

    let problemsSolved = 0;

    if (statusRes.ok) {
      const statusJson: CFStatusResponse = await statusRes.json();
      if (statusJson.status === "OK" && Array.isArray(statusJson.result)) {
        // Count unique problems with an "OK" verdict
        const solved = new Set<string>();
        for (const sub of statusJson.result) {
          if (sub.verdict === "OK" && sub.problem) {
            const key = `${sub.problem.contestId ?? ""}-${sub.problem.index ?? ""}`;
            solved.add(key);
          }
        }
        problemsSolved = solved.size;
      }
    }
    // If the status endpoint fails, we still return the profile data we have.

    return {
      data: { rating, maxRating, rank, problemsSolved },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: `fetchCodeforcesProfile failed: ${message}` };
  }
}
