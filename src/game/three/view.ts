import { PerspectiveCamera } from "three";
import { fitFov, type CameraPose } from "./world";

/**
 * Camera and look constants for the 3D run. The camera is low and behind the
 * army, centred on the track (it does not follow steering).
 */

/** Camera height above the track (world units). */
export const CAMERA_HEIGHT = 6;
/** How far behind the army the camera stands. */
export const CAMERA_BACK = 14;
/** The point the camera looks at: this far ahead of the army… */
export const LOOK_AHEAD = 30;
/** …and this high. */
export const LOOK_HEIGHT = 0;
/** Vertical field of view (degrees) on wide screens. */
export const FOV = 45;
/** Both track edges stay in view at the army with this much to spare (narrow screens widen the view). */
export const EDGE_MARGIN = 1.06;
/** Most device pixels per CSS pixel the 3D canvas draws. */
export const MAX_DPR = 2;

export const POSE: CameraPose = {
  height: CAMERA_HEIGHT,
  back: CAMERA_BACK,
  lookAhead: LOOK_AHEAD,
  lookHeight: LOOK_HEIGHT,
};

/** Bright daylight colours (original; genre-inspired only). */
export const LOOK = {
  sky: 0x9fdcff,
  ground: 0x7fcf6a,
  track: 0xf3ecf8,
  edge: 0xff7a59,
  marking: 0xc9b8e6,
} as const;

/** The run's camera, posed and fitted to the screen's aspect. */
export function makeCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 400);
  camera.position.set(0, CAMERA_HEIGHT, CAMERA_BACK);
  camera.lookAt(0, LOOK_HEIGHT, -LOOK_AHEAD);
  return camera;
}

export function fitCamera(camera: PerspectiveCamera, aspect: number): void {
  camera.aspect = aspect;
  camera.fov = fitFov(POSE, aspect, FOV, EDGE_MARGIN);
  camera.updateProjectionMatrix();
}
