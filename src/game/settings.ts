import type { SpeedPreset } from "../core/tuning";
import type { SyncStatus } from "../sync/sync";

/** What the settings panel shows; read again every frame while it is open. */
export type SettingsView = {
  speed: SpeedPreset;
  /** The WaniKani line, e.g. `WaniKani · level 14 · 3 due`; null with no token. */
  wkLabel: string | null;
  hasToken: boolean;
  /** Sync status; null hides the section (not configured, or meaning mode). */
  sync: SyncStatus | null;
};

export type SettingsOptions = {
  view: () => SettingsView;
  onSpeed: (s: SpeedPreset) => void;
  /** Opens the token form (the panel closes first). */
  onToken: () => void;
  /** Log in / out, or retry when offline (the panel closes first). */
  onSync: () => void;
  build: string;
};

const SPEEDS: readonly SpeedPreset[] = ["relaxed", "normal", "fast"];

const CSS = `
.kr-set { position: fixed; inset: 0; display: flex; justify-content: center;
  overflow-y: auto; padding: 16px; box-sizing: border-box; background: #111;
  font: 16px system-ui, sans-serif; color: #f2f2f2; z-index: 10; outline: none; }
.kr-set .body { width: 100%; max-width: 360px; display: flex; flex-direction: column; }
.kr-set header { display: flex; align-items: center; gap: 4px; margin-left: -10px; }
.kr-set h1 { margin: 0; font-size: 22px; }
.kr-set h2 { margin: 28px 0 10px; font-size: 13px; font-weight: 600;
  color: #9aa3b5; letter-spacing: 0.06em; }
.kr-set button { font: inherit; color: #f2f2f2; cursor: pointer; }
.kr-set .back { width: 44px; height: 44px; border: 0; background: none; font-size: 26px; }
.kr-set .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px; padding: 4px; background: #1d2230; border: 1px solid #5a6478; border-radius: 12px; }
.kr-set .seg button { height: 44px; border: 0; border-radius: 9px; background: none; color: #9aa3b5; }
.kr-set .seg button[aria-checked="true"] { background: #2f6b48; color: #f2f2f2; font-weight: 600; }
.kr-set .card { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 56px; padding: 6px 6px 6px 16px; background: #1d2230; border-radius: 12px; }
.kr-set .card span { overflow-wrap: anywhere; }
.kr-set .card button { min-height: 44px; padding: 0 14px; border: 1px solid #8892a8;
  border-radius: 8px; background: none; white-space: nowrap; }
.kr-set .note { margin: 8px 0 0; font-size: 12px; color: #9aa3b5; }
.kr-set .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  margin-right: 8px; vertical-align: 1px; }
.kr-set footer { margin-top: 40px; text-align: center; font-size: 11px; line-height: 1.6; color: #9aa3b5; }
.kr-set footer a { color: #9aa3b5; }
`;

const SYNC_TEXT: Record<SyncStatus, [string, string, string]> = {
  synced: ["Synced", "#5fd38d", "Log out"],
  offline: ["Offline", "#9aa3b5", "Retry"],
  login: ["Not logged in", "#ffb347", "Log in"],
  disabled: ["", "", ""],
};

let open: { overlay: HTMLElement; key: string; o: SettingsOptions } | null =
  null;

/** Whether the settings panel is up; the game ignores taps and keys meanwhile. */
export const settingsOpen = (): boolean => open !== null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export function closeSettings(): void {
  open?.overlay.remove();
  open = null;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function build(o: SettingsOptions, v: SettingsView): HTMLElement {
  const speed = el("div", { className: "seg" });
  speed.setAttribute("role", "radiogroup");
  speed.setAttribute("aria-label", "Speed");
  for (const s of SPEEDS) {
    const b = el(
      "button",
      { type: "button", onclick: () => o.onSpeed(s) },
      cap(s),
    );
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(s === v.speed));
    speed.append(b);
  }
  const then = (fn: () => void) => () => {
    closeSettings();
    fn();
  };
  const body = el(
    "div",
    { className: "body" },
    el(
      "header",
      {},
      el(
        "button",
        { type: "button", className: "back", onclick: closeSettings },
        "‹",
      ),
      el("h1", {}, "Settings"),
    ),
    el("h2", {}, "SPEED"),
    speed,
    el("h2", {}, "WANIKANI"),
    el(
      "div",
      { className: "card" },
      el("span", {}, v.wkLabel ?? "No token"),
      el(
        "button",
        { type: "button", onclick: then(o.onToken) },
        v.hasToken ? "Token…" : "Add token…",
      ),
    ),
    el("p", { className: "note" }, "Used for mnemonics and stories."),
  );
  body.querySelector(".back")?.setAttribute("aria-label", "Back");
  if (v.sync && v.sync !== "disabled") {
    const [label, color, action] = SYNC_TEXT[v.sync];
    const dot = el("span", { className: "dot" });
    dot.style.background = color;
    body.append(
      el("h2", {}, "SYNC"),
      el(
        "div",
        { className: "card" },
        el("span", {}, dot, label),
        el("button", { type: "button", onclick: then(o.onSync) }, action),
      ),
    );
  }
  body.append(
    el(
      "footer",
      {},
      "Kanji data: KANJIDIC2 and KRADFILE",
      el("br"),
      "© EDRDG, CC BY-SA 4.0 · ",
      el(
        "a",
        {
          href: "https://www.edrdg.org/",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "edrdg.org",
      ),
      el("br"),
      `build ${o.build}`,
    ),
  );
  return body;
}

/** Opens the settings panel over the canvas. Does nothing if already open. */
export function openSettings(o: SettingsOptions): void {
  if (open) return;
  if (!document.getElementById("kr-set-css"))
    document.head.append(el("style", { id: "kr-set-css" }, CSS));
  const overlay = el("div", { className: "kr-set" });
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Settings");
  overlay.tabIndex = -1;
  // keep keys away from the game's key bindings
  overlay.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") closeSettings();
  });
  document.body.append(overlay);
  open = { overlay, key: "", o };
  syncSettings();
  queueMicrotask(() => overlay.focus());
}

/** Redraws the open panel when what it shows has changed; call every frame. */
export function syncSettings(): void {
  if (!open) return;
  const v = open.o.view();
  const key = JSON.stringify(v);
  if (key === open.key) return;
  open.key = key;
  open.overlay.replaceChildren(build(open.o, v));
}
