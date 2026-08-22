/**
 * Local identity for the signed-out prototype.
 *
 * There is no auth yet, so the profile row created by PUT /api/profile is
 * remembered in localStorage and sent explicitly by the callers that need it
 * (beacons, message drafting, sync).
 *
 * ponytail: browser-trusted identity — anyone can put any id here. Replace the
 * whole module with a Supabase auth session before this is public.
 */
const KEY = "parivar.profile_id";

export function getProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setProfileId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Private-mode / storage-disabled browsers: the id stays in React state
    // for this session only, which is enough to finish the current flow.
  }
}
