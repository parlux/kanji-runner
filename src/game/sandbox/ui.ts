import { RATINGS, type Gauntlet, type Rating } from "./gauntlet";
import type { SaveResult } from "../../sync/sync";

/** The gauntlet's screens over the run: the "Wave N" label, the rating card and the results. */

const CSS = `
.kr-gx { position: fixed; inset: 0; z-index: 10; display: flex;
  align-items: center; justify-content: center; padding: 16px;
  font: 16px system-ui, sans-serif; color: #f2f2f2; pointer-events: none; }
.kr-gx.dim { background: rgba(0,0,0,0.55); pointer-events: auto; }
.kr-gx .label { text-align: center; text-shadow: 0 2px 6px #000, 0 0 2px #000; }
.kr-gx .label b { display: block; font-size: 64px; font-weight: 800; }
.kr-gx .label span { font-size: 18px; }
.kr-gx .card { box-sizing: border-box; width: 100%; max-width: 360px;
  max-height: 100%; overflow-y: auto; display: flex; flex-direction: column;
  gap: 10px; padding: 18px; background: #1d2230; border: 1px solid #5a6478; }
.kr-gx h2 { margin: 0; font-size: 22px; font-weight: 600; }
.kr-gx p { margin: 0; color: #9aa3b5; font-size: 15px; }
.kr-gx p.good { color: #7ddc95; }
.kr-gx p.bad { color: #ffb36b; }
.kr-gx button { font: inherit; padding: 13px; color: #f2f2f2;
  background: #111; border: 1px solid #8892a8; cursor: pointer; }
.kr-gx button.primary { background: #2f6b48; }
.kr-gx .row { display: flex; gap: 10px; }
.kr-gx .row button { flex: 1; }
.kr-gx ol { margin: 0; padding-left: 22px; font-size: 13px; color: #c9cfdb; }
.kr-gx li { margin: 2px 0; }
`;

/** The results screen's line about saving. */
export function saveMessage(result: SaveResult | "saving"): {
  text: string;
  tone: "good" | "bad" | "";
} {
  switch (result) {
    case "saving":
      return { text: "Saving to your account…", tone: "" };
    case "saved":
      return { text: "Saved to your account.", tone: "good" };
    case "login":
      return {
        text: "Not logged in, so not saved. Log in and try again, or Share / Copy.",
        tone: "bad",
      };
    case "offline":
      return {
        text: "Couldn't reach the server, so not saved. Try again, or Share / Copy.",
        tone: "bad",
      };
    case "disabled":
      return {
        text: "Saving isn't set up in this build. Share / Copy instead.",
        tone: "bad",
      };
  }
}

export type GauntletUiHandlers = {
  onRate: (r: Rating) => void;
  /** Saves the results; the screen shows what came back. */
  onSave: () => Promise<SaveResult>;
  /** Opens the log-in form; calls back once signed in. */
  onLogin: (done: () => void) => void;
  /** The results as text (Share and Copy). */
  text: () => string;
  onAgain: () => void;
  onExit: () => void;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers, or no permission: a selected textarea
    const area = el("textarea", { value: text });
    area.style.cssText = "position:fixed;opacity:0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** The overlay; `sync` shows what the gauntlet's phase needs (rebuilt only when it changes). */
export function createGauntletUi(h: GauntletUiHandlers): {
  sync(g: Gauntlet): void;
} {
  if (!document.getElementById("kr-gx-css"))
    document.head.append(el("style", { id: "kr-gx-css", textContent: CSS }));
  const root = el("div", { className: "kr-gx" });
  for (const type of ["pointerdown", "pointerup", "click", "touchstart"])
    root.addEventListener(type, (e) => e.stopPropagation());
  document.body.append(root);
  let shown = "";

  const label = (g: Gauntlet) => {
    root.className = "kr-gx";
    root.replaceChildren(
      el(
        "div",
        { className: "label" },
        el("b", { textContent: `Wave ${g.index + 1}` }),
        el("span", { textContent: `of ${g.presets.length}` }),
      ),
    );
  };

  const card = (g: Gauntlet) => {
    root.className = "kr-gx dim";
    const box = el(
      "div",
      { className: "card" },
      el("h2", { textContent: `Wave ${g.index + 1}: how did it feel?` }),
    );
    for (const r of RATINGS) {
      const b = el("button", {
        textContent: r.label,
        className: r.id === "right" ? "primary" : "",
      });
      b.dataset.rating = r.id;
      b.onclick = () => {
        // gone at once, so a second tap can't land on it
        root.className = "kr-gx";
        root.replaceChildren();
        h.onRate(r.id);
      };
      box.append(b);
    }
    root.replaceChildren(box);
  };

  const results = (g: Gauntlet) => {
    root.className = "kr-gx dim";
    const status = el("p");
    const show = (r: SaveResult | "saving") => {
      const m = saveMessage(r);
      status.textContent = m.text;
      status.className = m.tone;
      retry.style.display = r === "login" || r === "offline" ? "" : "none";
      retry.textContent = r === "login" ? "Log in" : "Try again";
    };
    const save = () => {
      show("saving");
      void h.onSave().then(show);
    };
    const retry = el("button");
    retry.onclick = () =>
      retry.textContent === "Log in" ? h.onLogin(save) : save();
    const note = el("p");
    const share = el("button", { textContent: "Share" });
    share.onclick = () =>
      void navigator
        .share({ title: "Horde gauntlet", text: h.text() })
        .catch(() => undefined);
    if (typeof navigator.share !== "function") share.style.display = "none";
    const copy = el("button", { textContent: "Copy" });
    copy.onclick = () =>
      void copyText(h.text()).then((ok) => {
        note.textContent = ok ? "Copied." : "Couldn't copy.";
      });
    const list = el("ol");
    for (const w of g.log)
      list.append(
        el("li", {
          textContent: `${RATINGS.find((r) => r.id === w.rating)?.label ?? "-"} · ${
            w.killSeconds === null ? "reached you" : `${w.killSeconds} s`
          } · lost ${w.lost}`,
        }),
      );
    const again = el("button", { textContent: "Play again" });
    again.onclick = h.onAgain;
    const exit = el("button", { textContent: "Back to the game" });
    exit.onclick = h.onExit;
    root.replaceChildren(
      el(
        "div",
        { className: "card" },
        el("h2", { textContent: "Gauntlet done" }),
        status,
        retry,
        el("div", { className: "row" }, share, copy),
        note,
        list,
        el("div", { className: "row" }, again, exit),
      ),
    );
    save();
  };

  return {
    sync(g) {
      const key = `${g.phase}:${g.index}`;
      if (key === shown) return;
      shown = key;
      if (g.phase === "intro") label(g);
      else if (g.phase === "rate") card(g);
      else if (g.phase === "done") results(g);
      else {
        root.className = "kr-gx";
        root.replaceChildren();
      }
    },
  };
}
