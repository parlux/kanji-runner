export const TOKEN_URL =
  "https://www.wanikani.com/settings/personal_access_tokens";

/** A saved token shown back only as its last 4 characters, e.g. `••••9f3a`. */
export function maskToken(token: string): string {
  const t = token.trim();
  return t.length >= 12 ? `••••${t.slice(-4)}` : "••••";
}

const CSS = `
.kr-wk { position: fixed; inset: 0; display: flex; align-items: center;
  justify-content: center; padding: 16px; background: rgba(0,0,0,0.7);
  font: 16px system-ui, sans-serif; color: #f2f2f2; z-index: 10; }
.kr-wk form { box-sizing: border-box; width: 100%; max-width: 340px;
  display: flex; flex-direction: column; gap: 12px; padding: 20px;
  background: #1d2230; border: 1px solid #5a6478; }
.kr-wk h2 { margin: 0 0 4px; font-size: 22px; font-weight: 600; }
.kr-wk p { margin: 0; color: #9aa3b5; font-size: 15px; line-height: 1.4; }
.kr-wk a { color: #6cc4ff; }
.kr-wk label { display: flex; flex-direction: column; gap: 4px;
  font-size: 14px; color: #9aa3b5; }
.kr-wk input { font: inherit; font-size: 16px; padding: 10px;
  color: #f2f2f2; background: #111; border: 1px solid #5a6478; }
.kr-wk button { font: inherit; padding: 12px; color: #f2f2f2;
  background: #111; border: 1px solid #8892a8; cursor: pointer; }
.kr-wk button.primary { background: #2f6b48; }
.kr-wk button.danger { border-color: #b04a4a; color: #ff9b9b; }
.kr-wk .error { color: #ff6b6b; }
`;

let open: HTMLElement | null = null;

/** Whether the token form is up; the game ignores taps and keys meanwhile. */
export const tokenFormOpen = (): boolean => open !== null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export type TokenFormOptions = {
  /** The saved token, shown only masked; null when none. */
  saved: string | null;
  /** A message above the buttons, e.g. `WaniKani token invalid`. */
  error?: string;
  onSave: (token: string) => void;
  onRemove: () => void;
};

/** Opens the WaniKani token form over the canvas. Does nothing if already open. */
export function openTokenForm(o: TokenFormOptions): void {
  if (open) return;
  if (!document.getElementById("kr-wk-css"))
    document.head.append(el("style", { id: "kr-wk-css" }, CSS));

  const overlay = el("div", { className: "kr-wk" });
  const close = () => {
    overlay.remove();
    open = null;
  };
  // keep keys away from the game's key bindings
  overlay.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") close();
  });
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });

  const input = el("input", {
    type: "password",
    name: "wk-token",
    autocomplete: "off",
    spellcheck: false,
    required: true,
    placeholder: o.saved ? "Paste a new token to replace it" : "Paste token",
  });
  const error = el("p", { className: "error", hidden: !o.error });
  error.setAttribute("role", "alert");
  error.textContent = o.error ?? "";
  const link = el(
    "a",
    { href: TOKEN_URL, target: "_blank", rel: "noopener noreferrer" },
    "wanikani.com/settings/personal_access_tokens",
  );
  const form = el(
    "form",
    {},
    el("h2", {}, "WaniKani"),
    el(
      "p",
      {},
      "Practise the kanji you have learned. Create a read-only token (no permissions ticked) at ",
      link,
      ". It stays on this device.",
    ),
    ...(o.saved ? [el("p", {}, `Saved token: ${maskToken(o.saved)}`)] : []),
    el("label", {}, "Token", input),
    error,
    el("button", { type: "submit", className: "primary" }, "Save token"),
  );
  if (o.saved)
    form.append(
      el(
        "button",
        {
          type: "button",
          className: "danger",
          onclick: () => {
            close();
            o.onRemove();
          },
        },
        "Remove token",
      ),
    );
  form.append(el("button", { type: "button", onclick: close }, "Close"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const token = input.value.trim();
    if (!token) return;
    close();
    o.onSave(token);
  });
  overlay.append(form);
  document.body.append(overlay);
  open = overlay;
  queueMicrotask(() => input.focus());
}
