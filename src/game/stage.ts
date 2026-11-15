import { loadScene3d, type View3d } from "./view3d";

export type Stage = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The 3D view once WebGL is up, else null. */
  view3d: () => View3d | null;
  webgl: () => "pending" | "ok" | "failed";
};

/**
 * The two canvases: the run is drawn in 3D on a WebGL canvas behind `#game`.
 * Without WebGL the start screen says so and Play does nothing; the menus stay
 * on `#game`. Keeps both sized to the window.
 */
export function createStage(): Stage {
  const canvas = document.querySelector<HTMLCanvasElement>("#game");
  if (!canvas) throw new Error("Missing #game canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");
  let view3d: View3d | null = null;
  let webgl: "pending" | "ok" | "failed" = "pending";
  const canvas3d = document.querySelector<HTMLCanvasElement>("#world");

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view3d?.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", resize);
  resize();

  void loadScene3d()
    .then(({ createView3d }) => {
      view3d = canvas3d ? createView3d(canvas3d) : null;
      if (!view3d || !canvas3d) {
        webgl = "failed";
        return;
      }
      webgl = "ok";
      canvas3d.style.display = "block";
      resize();
    })
    .catch(() => {
      view3d = null;
      webgl = "failed";
    });

  return { canvas, ctx, view3d: () => view3d, webgl: () => webgl };
}
