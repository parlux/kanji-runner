import { MEANING_STORAGE_KEY, STORAGE_KEY } from "../storage/storage";
import type { Session } from "./scenes";

/** Where a session's results go: its progress key, and whether it syncs. */
export type Persistence = { progress: string; sync: boolean };

/**
 * Meaning mode saves under its own keys and
 * never syncs; the owner's session saves under the owner's keys and syncs.
 */
export function persistence(session: Session): Persistence {
  return session.meaning
    ? { progress: MEANING_STORAGE_KEY, sync: false }
    : { progress: STORAGE_KEY, sync: true };
}
