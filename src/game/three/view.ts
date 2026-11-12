import { PerspectiveCamera } from "three";
import { fitCameraTo, type CameraAim, type CameraFit } from "./world";

/**
 * Camera and look constants for the 3D run. The camera is behind and above
 * the army, centred on the track (it does not follow steering), and aimed so
 * the screen is mostly track, like the 2D layout: the army low, the fog line
 * high. Narrow screens get a higher, steeper camera so both edges stay in view.
 */

/** How far behind the army the camera stands (world units). */
export const CAMERA_BACK = 12;
/** Lowest camera height (world units); wide screens use it. */
export const CAMERA_MIN_HEIGHT = 12;
/** Where the army and the fog line sit, as shares of the screen height from the top. */
export const AIM: CameraAim = { armyY: 0.8, fogY: 0.23 };
/** Both track edges stay in view at the army with this much to spare. */
export const EDGE_MARGIN = 1.06;
/** Most device pixels per CSS pixel the 3D canvas draws. */
export const MAX_DPR = 2;

/** The camera for a screen of this aspect (width / height). */
export const cameraFit = (aspect: number): CameraFit =>
  fitCameraTo(aspect, CAMERA_BACK, CAMERA_MIN_HEIGHT, AIM, EDGE_MARGIN);

/** Bright daylight colours (original; genre-inspired only). */
export const LOOK = {
  sky: 0x9fdcff,
  /** The distance haze: a paler sky, so the far track softens into the horizon. */
  haze: 0xd4eeff,
  ground: 0x7fcf6a,
  track: 0xf3ecf8,
  edge: 0xff7a59,
  marking: 0xc9b8e6,
} as const;

/** The run's camera; `fitCamera` poses it for the screen. */
export function makeCamera(): PerspectiveCamera {
  return new PerspectiveCamera(45, 1, 0.5, 400);
}

/** Poses and fits the camera to `aspect`; returns the fit (for the fog). */
export function fitCamera(
  camera: PerspectiveCamera,
  aspect: number,
): CameraFit {
  const fit = cameraFit(aspect);
  const { pose } = fit;
  camera.position.set(0, pose.height, pose.back);
  camera.lookAt(0, pose.lookHeight, -pose.lookAhead);
  camera.aspect = aspect;
  camera.fov = fit.fov;
  camera.updateProjectionMatrix();
  return fit;
}
