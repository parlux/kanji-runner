import type { WaveLog } from "./gauntlet";
import { RATINGS } from "./gauntlet";

/** One gauntlet run as saved (the `data` of a `tuning_results` row) and shared. */
export type GauntletResults = {
  /** The build stamp (commit and build time). */
  version: string;
  /** ISO time the run finished. */
  createdAt: string;
  /** A short form of the browser's user agent. */
  device: string;
  waves: WaveLog[];
};

/**
 * A short device name from a user agent: what its first brackets say
 * (minus the generic bits) and the browser, e.g. "Android 14; Pixel 7 ·
 * Chrome 143".
 */
export function shortDevice(ua: string): string {
  const inside = /\(([^)]*)\)/.exec(ua)?.[1] ?? "";
  const parts = inside
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p && !/^(Linux|U|K|wv|X11|Mobile)$/.test(p));
  const m = /(Firefox|EdgA?|SamsungBrowser|CriOS|Chrome)\/(\d+)/.exec(ua);
  const safari = /Version\/(\d+).*Safari/.exec(ua);
  const name = m ? `${m[1]} ${m[2]}` : safari ? `Safari ${safari[1]}` : "";
  return [parts.join("; "), name].filter(Boolean).join(" · ").slice(0, 80);
}

export function buildResults(
  waves: readonly WaveLog[],
  version: string,
  now: Date,
  userAgent: string,
): GauntletResults {
  return {
    version,
    createdAt: now.toISOString(),
    device: shortDevice(userAgent),
    waves: [...waves],
  };
}

const ratingLabel = (r: string | null): string =>
  RATINGS.find((x) => x.id === r)?.label ?? "-";

/** One line per wave: what it was, what it measured, how it felt. */
export function waveLine(w: WaveLog): string {
  const p = w.preset;
  const kill = w.killSeconds === null ? "reached you" : `${w.killSeconds}s`;
  return (
    `${w.wave}. ${ratingLabel(w.rating)} | army ${p.army} (pack for ${p.expected}), ` +
    `${p.enemies} enemies, kill ${p.killSeconds}s, width ${p.packWidth}, size ${p.hordeScale}, adapt ${p.packAdapt} ` +
    `| measured: kill ${kill}, ${w.enemies} enemies, reached ${w.reached}, lost ${w.lost}${w.died ? " (died)" : ""}, ${w.fps} fps` +
    ` | ${p.note}`
  );
}

/** The results as text, for Share and Copy. */
export function resultsText(r: GauntletResults): string {
  return [
    `Horde gauntlet ${r.createdAt.slice(0, 16).replace("T", " ")} UTC · build ${r.version} · ${r.device}`,
    ...r.waves.map(waveLine),
  ].join("\n");
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** A saved row's data as results, or null when it isn't one (an older or broken row). */
export function parseResults(data: unknown): GauntletResults | null {
  if (!isObj(data) || !Array.isArray(data.waves)) return null;
  const { version, createdAt, device } = data;
  if (
    typeof version !== "string" ||
    typeof createdAt !== "string" ||
    typeof device !== "string"
  )
    return null;
  const waves = data.waves.filter(
    (w): w is WaveLog =>
      isObj(w) &&
      typeof w.wave === "number" &&
      isObj(w.preset) &&
      typeof w.lost === "number",
  );
  if (waves.length !== data.waves.length) return null;
  return { version, createdAt, device, waves };
}
