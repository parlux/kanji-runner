import { MEANING_SESSION_KEY, SESSION_KEY } from "../storage/session";
import { MEANING_STORAGE_KEY, STORAGE_KEY } from "../storage/storage";
import type { Session } from "./scenes";

/** Where a session's results go: its progress and session-log keys, and whether it syncs. */
export type Persistence = { progress: string; log: string; sync: boolean };

/**
 * A dev sandbox saves nothing (null). Meaning mode saves under its own keys and
 * never syncs; the owner's session saves under the owner's keys and syncs.
 */
export function persistence(session: Session): Persistence | null {
  if (!session.persist) return null;
  return session.meaning
    ? { progress: MEANING_STORAGE_KEY, log: MEANING_SESSION_KEY, sync: false }
    : { progress: STORAGE_KEY, log: SESSION_KEY, sync: true };
}
