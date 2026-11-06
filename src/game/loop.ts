export const STEP = 1 / 60;
const MAX_FRAME = 0.25;

/** Fixed-timestep loop: `update` always gets STEP seconds; `render` runs once per frame. */
export function startLoop(
  update: (dt: number) => void,
  render: () => void,
): void {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number): void => {
    acc += Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
