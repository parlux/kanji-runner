import type { Progress } from "../core/types";
import type { SignInResult, Sync } from "./sync";

/** The message shown when sign-in fails. */
export function loginError(
  reason: Extract<SignInResult, { ok: false }>["reason"],
): string {
  switch (reason) {
    case "credentials":
      return "Wrong email or password.";
    case "offline":
      return "Can't reach the sync server. Play offline and try again later.";
    case "disabled":
      return "Sync is not set up for this build.";
  }
}

const CSS = `
.kr-login { position: fixed; inset: 0; display: flex; align-items: center;
  justify-content: center; padding: 16px; background: rgba(0,0,0,0.7);
  font: 16px system-ui, sans-serif; color: #f2f2f2; z-index: 10; }
.kr-login form { box-sizing: border-box; width: 100%; max-width: 340px;
  display: flex; flex-direction: column; gap: 12px; padding: 20px;
  background: #1d2230; border: 1px solid #5a6478; }
.kr-login h2 { margin: 0 0 4px; font-size: 22px; font-weight: 600; }
.kr-login p { margin: 0; color: #9aa3b5; font-size: 15px; }
.kr-login label { display: flex; flex-direction: column; gap: 4px;
  font-size: 14px; color: #9aa3b5; }
.kr-login input { font: inherit; font-size: 16px; padding: 10px;
  color: #f2f2f2; background: #111; border: 1px solid #5a6478; }
.kr-login button { font: inherit; padding: 12px; color: #f2f2f2;
  background: #111; border: 1px solid #8892a8; cursor: pointer; }
.kr-login button.primary { background: #2f6b48; }
.kr-login button:disabled { opacity: 0.6; }
.kr-login .error { color: #ff6b6b; }
`;

let open: HTMLElement | null = null;

/** Whether the sync dialog is up; the game ignores taps and keys meanwhile. */
export const loginOpen = (): boolean => open !== null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/**
 * Opens the sync dialog over the canvas: an email/password form with a "play
 * offline" option, or, when already signed in, a sign-out option. `onProgress`
 * gets the progress a successful sign-in pulled. Does nothing if already open.
 */
export function openLogin(sync: Sync, onProgress: (p: Progress) => void): void {
  if (open || !sync.enabled) return;
  if (!document.getElementById("kr-login-css"))
    document.head.append(el("style", { id: "kr-login-css" }, CSS));

  const overlay = el("div", { className: "kr-login" });
  const close = () => {
    overlay.remove();
    open = null;
  };
  // keep keys (Enter, Space, Escape, arrows) away from the game's key bindings
  overlay.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") close();
  });
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close();
  });

  const form = el("form");
  if (sync.status() === "synced") {
    const out = el("button", { type: "submit" }, "Sign out");
    form.append(
      el("h2", {}, "Synced"),
      el("p", {}, "Progress syncs to your account on this device."),
      out,
      el(
        "button",
        { type: "button", className: "primary", onclick: close },
        "Close",
      ),
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      out.disabled = true;
      void sync.signOut().then(close);
    });
  } else {
    const email = el("input", {
      type: "email",
      name: "email",
      autocomplete: "username",
      required: true,
    });
    const password = el("input", {
      type: "password",
      name: "password",
      autocomplete: "current-password",
      required: true,
    });
    const error = el("p", { className: "error", hidden: true });
    error.setAttribute("role", "alert");
    const submit = el(
      "button",
      { type: "submit", className: "primary" },
      "Log in",
    );
    form.append(
      el("h2", {}, "Sync progress"),
      el("p", {}, "Log in to sync progress across devices."),
      el("label", {}, "Email", email),
      el("label", {}, "Password", password),
      error,
      submit,
      el("button", { type: "button", onclick: close }, "Play offline"),
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = "Logging in…";
      error.hidden = true;
      void sync.signIn(email.value.trim(), password.value).then((r) => {
        submit.disabled = false;
        submit.textContent = "Log in";
        if (r.ok) {
          onProgress(r.progress);
          return close();
        }
        error.textContent = loginError(r.reason);
        error.hidden = false;
        password.select();
      });
    });
    queueMicrotask(() => email.focus());
  }
  overlay.append(form);
  document.body.append(overlay);
  open = overlay;
}
