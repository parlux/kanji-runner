import { mnemonicNodes } from "../../core/mnemonic";
import { stageLine, type StoryRadical, type StudyCard } from "../../core/study";
import { NOTE_MAX } from "../../storage/flags";

/** Called when the player sends a flag for a kanji's story (with the optional note). */
export type FlagFn = (kanji: string, note: string) => void;

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
.kr-study .card.word { flex-direction: column; gap: 8px; }
.kr-study .card.word .big { width: auto; font-size: 40px; text-align: left; }
.kr-study .crumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.kr-study .crumb { display: flex; flex-direction: column; align-items: center;
  min-width: 44px; padding: 2px 6px; background: #111; border: 1px solid #5a6478; }
.kr-study .crumb .ch { font-size: 22px; line-height: 1.2; }
.kr-study .crumb .rm { font-size: 12px; color: #5fd38d; text-align: center; }
.kr-study .stage { font-size: 13px; color: #9aa3b5; }
.kr-study .wordreading { font-size: 20px; color: #46e0d6; }
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
.kr-study .mn-radical, .kr-study .mn-part { color: #6cc4ff; font-weight: 600; }
.kr-study .mn-kanji { color: #ff8ad0; font-weight: 600; }
.kr-study .mn-reading { color: #c4a0ff; font-weight: 600; }
.kr-study .mn-sound { color: #c4a0ff; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
.kr-study .mn-vocabulary { color: #ffc46b; font-weight: 600; }
.kr-study .mn-none { color: #9aa3b5; }
.kr-study .mn-ja { color: #5fd38d; }
.kr-study .mn-em { font-style: italic; font-weight: 600; color: #fff; }
.kr-study .empty { color: #9aa3b5; padding: 8px 0; }
.kr-study footer { display: flex; gap: 12px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }
.kr-study button { flex: 1; font: inherit; padding: 12px; color: #f2f2f2;
  background: #111; border: 1px solid #8892a8; cursor: pointer; }
.kr-study button.primary { background: #2f6b48; }
.kr-study .flag { align-self: flex-start; display: flex; flex-direction: column; gap: 6px;
  width: 100%; margin-top: 4px; }
.kr-study .flag button { flex: none; padding: 6px 12px; font-size: 14px; }
.kr-study .flag button:disabled { color: #9aa3b5; cursor: default; }
.kr-study .flag input { box-sizing: border-box; width: 100%; padding: 8px; font: inherit;
  font-size: 16px; color: #f2f2f2; background: #111; border: 1px solid #8892a8; }
.kr-study .flag .acts { display: flex; gap: 8px; }
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

/** The Flag button: a tap opens a note field with Send and Cancel; Send reads "Flagged". */
function flagEl(kanji: string, onFlag: FlagFn): HTMLElement {
  const box = el("div", "flag");
  // typing and taps here must not reach the game or resume the pause card
  for (const type of ["keydown", "keyup", "click"])
    box.addEventListener(type, (e) => e.stopPropagation());
  const button = (label: string, onclick: () => void) => {
    const b = el("button", "", label);
    b.type = "button";
    b.onclick = onclick;
    return b;
  };
  const flagged = () => {
    const b = button("Flagged", () => {});
    b.disabled = true;
    box.replaceChildren(b);
  };
  const idle = () => box.replaceChildren(button("Flag", form));
  const form = () => {
    const note = el("input");
    note.type = "text";
    note.maxLength = NOTE_MAX;
    note.placeholder = "What's wrong? (optional)";
    note.setAttribute("aria-label", "Note about this story");
    const send = () => {
      onFlag(kanji, note.value);
      flagged();
    };
    note.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
      else if (e.key === "Escape") idle();
    });
    box.replaceChildren(
      note,
      el("div", "acts", button("Send", send), button("Cancel", idle)),
    );
    note.focus();
  };
  idle();
  return box;
}

/** One study card; shared with the pause screen. Our stories get a Flag button when `onFlag` is given. */
export function cardEl(c: StudyCard, onFlag?: FlagFn): HTMLElement {
  const info = el("div", "info");
  if (c.missed) info.append(el("span", "tag", "missed"));
  if (c.kind === "kana") {
    info.append(el("div", "meaning", c.romaji), el("div", "row", c.script));
  } else if (c.kind === "word") {
    if (c.reading) info.append(el("div", "wordreading", c.reading));
    info.append(el("div", "meaning", c.meanings.join(", ")));
    const crumbs = el("div", "crumbs");
    crumbs.append(
      ...c.breakdown.map((p) =>
        el("span", "crumb", el("span", "ch", p.char), el("span", "rm", p.note)),
      ),
    );
    info.append(crumbs);
  } else {
    info.append(el("div", "meaning", c.meanings.join(", ")));
    if (c.on) info.append(line("on", c.on));
    if (c.kun) info.append(line("kun", c.kun));
    if (c.own) {
      if (c.parts?.length) {
        const chips = el("div", "radicals");
        chips.append(
          ...c.parts.map((p) =>
            el(
              "span",
              "rad",
              el("span", "glyph", p.char),
              ...(p.name ? [el("span", "rname", p.name)] : []),
            ),
          ),
        );
        info.append(el("div", "row", "parts"), chips);
      }
    } else if (c.radicals?.length) {
      info.append(el("div", "row", "radicals"), radicalsEl(c.radicals));
    } else if (c.components.length > 0) {
      const parts = el("div", "parts");
      parts.append(...c.components.map((p) => el("span", "part", p)));
      info.append(el("div", "row", "parts"), parts);
    }
  }
  const stage = stageLine(c);
  // dim, right under the answer (the meaning line)
  if (stage) info.querySelector(".meaning")?.after(el("div", "stage", stage));
  const card = el(
    "div",
    c.kind === "word" ? "card word" : "card",
    el("div", "big", c.char),
    info,
  );
  if (c.kind === "kanji") {
    const block = (head: (Node | string)[], body: Node[]) => {
      const p = el("p");
      p.append(...body);
      info.append(el("div", "mn", el("h3", "", ...head), p));
    };
    const noun = c.own ? "story" : "mnemonic";
    if (c.mnemonics?.meaning)
      block([`Meaning ${noun}`], mnemonicNodes(c.mnemonics.meaning));
    for (const r of c.readingStories ?? []) {
      const head: (Node | string)[] = [`Reading ${noun}: ${r.reading}`];
      if ("none" in r) {
        const note = el(
          "p",
          "mn-none",
          "No story for this reading. This one just needs remembering.",
        );
        info.append(el("div", "mn", el("h3", "", ...head), note));
        continue;
      }
      if (r.source !== "kanji") {
        head.push(" (from ", el("span", "mn-kanji", r.source.word));
        if (r.source.wordReading) head.push(` ${r.source.wordReading}`);
        head.push(")");
      }
      block(head, mnemonicNodes(r.text));
    }
    if (c.own && onFlag) info.append(flagEl(c.char, onFlag));
  }
  return card;
}

/**
 * Opens the study screen over the canvas: one scrollable card per missed item
 * (marked "missed"), then one per other kanji from the run.
 * "Play again" closes it and calls `onPlay`; Escape or "Back" just closes it.
 * Does nothing if already open.
 */
export function openStudy(
  cards: readonly StudyCard[],
  onPlay: () => void,
  onFlag?: FlagFn,
) {
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
  else list.append(...cards.map((c) => cardEl(c, onFlag)));
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
