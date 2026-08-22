/**
 * Local identity for the signed-out prototype.
 *
 * The id is remembered in localStorage so the UI can reload the right profile
 * and send it to profile-scoped routes. It is not proof of ownership: writes
 * are authorised by the server-managed HttpOnly profile session cookie.
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
