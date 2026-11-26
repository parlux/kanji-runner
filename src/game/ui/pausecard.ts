import type { LastAnswer } from "../../core/study";
import { SPEED_PRESETS, type SpeedPreset } from "../../core/tuning";
import { cardEl, installStudyCss, type FlagFn } from "./study";

const CSS = `
.kr-pause { position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 16px; z-index: 5;
  font: 16px system-ui, sans-serif; color: #f2f2f2; pointer-events: none; }
.kr-pause > .panel { box-sizing: border-box; width: 100%; max-width: 480px;
  max-height: calc(100% - 56px); display: flex; flex-direction: column; gap: 10px;
  pointer-events: auto; cursor: pointer; }
.kr-pause h2 { margin: 0; text-align: center; font-size: 32px; font-weight: 600; }
.kr-pause .verdict { padding: 10px 14px; background: #1d2230; border: 1px solid #5a6478;
  display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
.kr-pause .verdict .kind { font-size: 12px; font-weight: 600; color: #9aa3b5;
  text-transform: uppercase; letter-spacing: 0.04em; }
.kr-pause .verdict .ok { color: #5fd38d; font-weight: 600; }
.kr-pause .verdict .bad { color: #ff6b6b; font-weight: 600; }
.kr-pause .scroll { min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.kr-pause .card .tag { display: none; }
.kr-pause .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px; padding: 4px; background: #1d2230; border: 1px solid #5a6478; border-radius: 12px; }
.kr-pause .seg button { font: inherit; cursor: pointer; height: 44px; border: 0;
  border-radius: 9px; background: none; color: #9aa3b5; }
.kr-pause .seg button[aria-checked="true"] { background: #2f6b48; color: #f2f2f2; font-weight: 600; }
.kr-pause .hint { text-align: center; font-size: 15px; color: #9aa3b5; }
`;

const ASKED: Record<LastAnswer["type"], string> = {
  kana: "Kana → romaji",
  meaning: "Kanji → meaning",
  reading: "Kanji → reading",
  word: "Word → meaning",
  wordreading: "Word → reading",
};

let shown: { el: HTMLElement; key: string } | null = null;

function span(className: string, text: string): HTMLElement {
  const s = document.createElement("span");
  s.className = className;
  s.textContent = text;
  return s;
}

const SPEEDS = Object.keys(SPEED_PRESETS) as SpeedPreset[];

/** The speed row's current preset and what a tap on a preset does. */
export type PauseSpeed = {
  current: SpeedPreset;
  onSpeed: (s: SpeedPreset) => void;
};

function speedRow({ current, onSpeed }: PauseSpeed): HTMLElement {
  const row = document.createElement("div");
  row.className = "seg";
  row.setAttribute("role", "radiogroup");
  row.setAttribute("aria-label", "Speed");
  for (const s of SPEEDS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(s === current));
    b.onclick = (e) => {
      // a speed change does not resume
      e.stopPropagation();
      onSpeed(s);
    };
    row.append(b);
  }
  return row;
}

function panel(
  last: LastAnswer | null,
  speed: PauseSpeed,
  onTap: () => void,
  onFlag?: FlagFn,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "kr-study kr-pause";
  // .kr-study supplies the card styles; undo its full-screen look
  root.style.background = "transparent";
  const box = document.createElement("div");
  box.className = "panel";
  box.onclick = onTap;
  const title = document.createElement("h2");
  title.textContent = "Paused";
  box.append(title);
  if (last) {
    const verdict = document.createElement("div");
    verdict.className = "verdict";
    verdict.append(
      span("kind", `Last: ${ASKED[last.type]}`),
      span("", last.prompt),
      last.correct
        ? span("ok", `✓ ${last.picked}`)
        : span("bad", `✗ ${last.picked}`),
    );
    if (!last.correct) verdict.append(span("ok", `→ ${last.answer}`));
    const scroll = document.createElement("div");
    scroll.className = "scroll";
    if (last.card) scroll.append(cardEl(last.card, onFlag));
    box.append(verdict, scroll);
  }
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Tap or P to resume";
  box.append(speedRow(speed), hint);
  root.append(box);
  return root;
}

/** Removes the pause panel (not paused). */
export function hidePauseCard(): void {
  shown?.el.remove();
  shown = null;
}

/**
 * Shows the pause panel: the title, the last answer with its study card (null:
 * none), the speed row and the hint. Call every frame: it rebuilds only when
 * `key` or the speed changes. A tap on the panel calls `onTap` (resume); taps
 * around it fall through to the canvas.
 */
export function syncPauseCard(
  last: LastAnswer | null,
  key: string,
  speed: PauseSpeed,
  onTap: () => void,
  onFlag?: FlagFn,
): void {
  const full = `${key}:${speed.current}`;
  if (shown?.key === full) return;
  shown?.el.remove();
  installStudyCss();
  if (!document.getElementById("kr-pause-css")) {
    const style = document.createElement("style");
    style.id = "kr-pause-css";
    style.textContent = CSS;
    document.head.append(style);
  }
  const el = panel(last, speed, onTap, onFlag);
  document.body.append(el);
  shown = { el, key: full };
}
