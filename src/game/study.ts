import { mnemonicNodes } from "../core/mnemonic";
import type { StoryRadical, StudyCard } from "../core/study";

const CSS = `
.kr-study { position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; background: #111; color: #f2f2f2; z-index: 10;
  font: 16px system-ui, sans-serif; outline: none; }
.kr-study > * { box-sizing: border-box; width: 100%; max-width: 480px; }
.kr-study h2 { margin: 0; padding: 14px 16px 8px; font-size: 22px; font-weight: 600; }
.kr-study .cards { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 16px 12px;
  display: flex; flex-direction: column; gap: 12px; -webkit-overflow-scrolling: touch; }
.kr-study .card { display: flex; gap: 14px; padding: 14px; background: #1d2230;
  border: 1px solid #5a6478; }
.kr-study .big { flex: none; width: 76px; font-size: 56px; line-height: 1.1;
  text-align: center; }
.kr-study .info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 6px;
  overflow-wrap: anywhere; }
.kr-study .meaning { font-size: 18px; font-weight: 600; }
.kr-study .tag { align-self: flex-start; padding: 1px 6px; font-size: 12px; font-weight: 600;
  color: #111; background: #ff6b6b; text-transform: uppercase; letter-spacing: 0.04em; }
.kr-study .row { font-size: 15px; color: #9aa3b5; }
.kr-study .row b { color: #5fd38d; font-weight: 600; }
.kr-study .parts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.kr-study .part { padding: 2px 8px; font-size: 20px; background: #111;
  border: 1px solid #5a6478; }
.kr-study .radicals { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.kr-study .rad { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px;
  background: #111; border: 1px solid #5a6478; color: #6cc4ff; font-weight: 600; }
.kr-study .rad .glyph { font-size: 20px; }
.kr-study .rad img { height: 1.2em; width: 1.2em; filter: invert(0.8) sepia(1) saturate(6) hue-rotate(172deg); }
.kr-study .rad .rname { font-size: 14px; }
.kr-study .mn { font-size: 14px; line-height: 1.45; color: #cfd5e2; }
.kr-study .mn h3 { margin: 0 0 2px; font-size: 12px; font-weight: 600;
  color: #9aa3b5; text-transform: uppercase; letter-spacing: 0.04em; }
.kr-study .mn p { margin: 0; white-space: pre-line; }
.kr-study .mn-radical { color: #6cc4ff; font-weight: 600; }
.kr-study .mn-kanji { color: #ff8ad0; font-weight: 600; }
.kr-study .mn-reading { color: #c4a0ff; font-weight: 600; }
.kr-study .mn-vocabulary { color: #ffc46b; font-weight: 600; }
.kr-study .mn-ja { color: #5fd38d; }
.kr-study .mn-em { font-style: italic; font-weight: 600; color: #fff; }
.kr-study .empty { color: #9aa3b5; padding: 8px 0; }
.kr-study footer { display: flex; gap: 12px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }
.kr-study button { flex: 1; font: inherit; padding: 12px; color: #f2f2f2;
  background: #111; border: 1px solid #8892a8; cursor: pointer; }
.kr-study button.primary { background: #2f6b48; }
`;

let open: HTMLElement | null = null;

/** Adds the study styles (`.kr-study` and its cards) once. */
export function installStudyCss(): void {
  if (document.getElementById("kr-study-css")) return;
  const style = el("style", "", CSS);
  style.id = "kr-study-css";
  document.head.append(style);
}

/** Whether the study screen is up; the game ignores taps and keys meanwhile. */
export const studyOpen = (): boolean => open !== null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

function line(label: string, value: string): HTMLElement {
  return el("div", "row", `${label} `, el("b", "", value));
}

function radicalChip(r: StoryRadical): HTMLElement {
  const chip = el("span", "rad");
  if (r.char) chip.append(el("span", "glyph", r.char));
  else if (r.image) {
    const img = document.createElement("img");
    img.alt = r.name;
    img.src = r.image;
    img.onerror = () => img.remove(); // the name below still shows
    chip.append(img);
  }
  chip.append(el("span", "rname", r.name));
  return chip;
}

function radicalsEl(rs: readonly StoryRadical[]): HTMLElement {
  return el("div", "radicals", ...rs.map(radicalChip));
}

/** One study card; shared with the pause screen. */
export function cardEl(c: StudyCard): HTMLElement {
  const info = el("div", "info");
  if (c.missed) info.append(el("span", "tag", "missed"));
  if (c.kind === "kana") {
    info.append(el("div", "meaning", c.romaji), el("div", "row", c.script));
  } else {
    info.append(el("div", "meaning", c.meanings.join(", ")));
    if (c.on) info.append(line("on", c.on));
    if (c.kun) info.append(line("kun", c.kun));
    if (c.radicals?.length) {
      info.append(el("div", "row", "radicals"), radicalsEl(c.radicals));
    } else if (c.components.length > 0) {
      const parts = el("div", "parts");
      parts.append(...c.components.map((p) => el("span", "part", p)));
      info.append(el("div", "row", "parts"), parts);
    }
  }
  const card = el("div", "card", el("div", "big", c.char), info);
  if (c.kind === "kanji" && c.mnemonics) {
    const notes = [
      ["Meaning mnemonic", c.mnemonics.meaning],
      ["Reading mnemonic", c.mnemonics.reading],
    ] as const;
    for (const [title, text] of notes) {
      if (!text) continue;
      const body = el("p");
      body.append(...mnemonicNodes(text));
      info.append(el("div", "mn", el("h3", "", title), body));
    }
  }
  return card;
}

/**
 * Opens the study screen over the canvas: one scrollable card per missed item
 * (marked "missed"), then one per other kanji from the run.
 * "Play again" closes it and calls `onPlay`; Escape or "Back" just closes it.
 * Does nothing if already open.
 */
export function openStudy(cards: readonly StudyCard[], onPlay: () => void) {
  if (open) return;
  installStudyCss();
  const overlay = el("div", "kr-study");
  overlay.tabIndex = -1;
  const close = () => {
    overlay.remove();
    open = null;
  };
  const play = () => {
    close();
    onPlay();
  };
  // keep keys away from the game's key bindings (Enter would be swallowed)
  overlay.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") close();
  });

  const list = el("div", "cards");
  if (cards.length === 0) list.append(el("div", "empty", "Nothing to study."));
  else list.append(...cards.map(cardEl));
  const back = el("button", "", "Back");
  back.type = "button";
  back.onclick = close;
  const again = el("button", "primary", "Play again");
  again.type = "button";
  again.onclick = play;
  overlay.append(
    el("h2", "", `Study (${cards.length})`),
    list,
    el("footer", "", back, again),
  );
  document.body.append(overlay);
  open = overlay;
  again.focus();
}
