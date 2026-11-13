/**
 * `?fps`: a small frame-rate readout in the bottom-left corner of the 3D view
 * (clear of the HUD at the top and the gate labels), for checking a phone,
 * shown while the run is drawn. Off without the flag; the 2D view never has it.
 */

/** Whether the page asked for the readout. */
export const fpsParam = (search: string): boolean =>
  new URLSearchParams(search).has("fps");

/** Frames per second over the last `window` ms of frame times (ms). */
export function createFpsMeter(window = 1000, size = 256) {
  const times = new Float64Array(size);
  let head = 0;
  let count = 0;
  return {
    /** Records a frame at `now` (ms); returns the rolling frame rate (0 until two frames). */
    tick(now: number): number {
      times[head] = now;
      head = (head + 1) % size;
      count = Math.min(count + 1, size);
      // the oldest frame still inside the window
      let n = 1;
      let oldest = now;
      while (n < count) {
        const t = times[(head - 1 - n + size) % size] as number;
        if (now - t > window) break;
        oldest = t;
        n++;
      }
      return n > 1 ? ((n - 1) * 1000) / (now - oldest) : 0;
    },
  };
}

/** The readout's element, added to the page, or null without `?fps`. */
export function createFpsReadout(): { frame(now: number): void } | null {
  if (!fpsParam(window.location.search)) return null;
  const el = document.createElement("div");
  el.id = "fps";
  el.style.cssText =
    "position:fixed;left:6px;bottom:6px;z-index:5;padding:2px 6px;" +
    "font:12px/1.3 ui-monospace,monospace;color:#fff;" +
    "background:rgba(0,0,0,0.45);border-radius:4px;pointer-events:none";
  el.style.display = "none";
  document.body.appendChild(el);
  const meter = createFpsMeter();
  let shown = -Infinity;
  let last = -Infinity;
  // shown only while the 3D run is drawn (not over menus)
  setInterval(() => {
    if (performance.now() - last > 500) el.style.display = "none";
  }, 250);
  return {
    frame(now) {
      last = now;
      el.style.display = "block";
      const fps = meter.tick(now);
      // the text changes 4 times a second, so it can be read
      if (now - shown < 250) return;
      shown = now;
      el.textContent = `${Math.round(fps)} fps`;
    },
  };
}
