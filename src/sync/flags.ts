import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFlags, removeFlags } from "../storage/flags";
import type { KeyValueStore } from "../storage/storage";

/**
 * Inserts the queued story flags into `story_flags` (user_id defaults to the
 * signed-in user) and drops the sent ones from the queue. A failure keeps them
 * for next time. Never throws.
 */
export async function pushFlags(
  client: SupabaseClient,
  store: KeyValueStore,
): Promise<void> {
  try {
    const flags = loadFlags(store);
    if (flags.length === 0) return;
    const { error } = await client.from("story_flags").insert(
      flags.map((f) => ({
        kanji: f.kanji,
        level: f.level,
        note: f.note,
        build: f.build,
        created_at: new Date(f.at).toISOString(),
      })),
    );
    if (!error) removeFlags(store, flags);
  } catch {
    // offline, signed out or the table is missing: the flags wait
  }
}
