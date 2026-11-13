import { PerspectiveCamera } from "three";
import {
  DEFAULT_CAMERA,
  HAZE_COLOUR,
  poseFromSettings,
  type CameraFit,
  type CameraSettings,
} from "./world";

/**
 * Camera and look constants for the 3D run. The camera is the tuned
 * `DEFAULT_CAMERA` (the owner's pick: low, 8° down, 15 away, narrow view) at
 * every screen size, or the settings saved on the device. It puts the army 80%
 * down the screen and follows its sideways steering (follow, smoothing); the
 * track runs up the screen into the haze.
 */

/** Where the army sits, as a share of the screen height from the top. */
export const AIM = { armyY: 0.8 } as const;
/** Most device pixels per CSS pixel the 3D canvas draws. */
export const MAX_DPR = 2;

/** Bright daylight colours (original; genre-inspired only). */
export const LOOK = {
  /** The distance haze: a paler sky, so the far track softens into the horizon. */
  haze: HAZE_COLOUR,
  ground: 0x7fcf6a,
  track: 0xf3ecf8,
  edge: 0xff7a59,
  marking: 0xc9b8e6,
} as const;

/** The run's camera; `fitCamera` poses it. */
export function makeCamera(): PerspectiveCamera {
  return new PerspectiveCamera(45, 1, 0.5, 400);
}

/** The camera for the saved `settings`, or the defaults. */
export const cameraFor = (settings: CameraSettings | null): CameraFit =>
  poseFromSettings(settings ?? DEFAULT_CAMERA, AIM.armyY);

/**
 * Poses and fits the camera to `aspect`, shifted sideways by `x` (camera and
 * look point together: no yaw). Returns the fit (for the fog).
 */
export function fitCamera(
  camera: PerspectiveCamera,
  aspect: number,
  fit: CameraFit,
  x = 0,
): CameraFit {
  const { pose } = fit;
  camera.position.set(x, pose.height, pose.back);
  camera.lookAt(x, pose.lookHeight, -pose.lookAhead);
  camera.aspect = aspect;
  camera.fov = fit.fov;
  camera.updateProjectionMatrix();
  return fit;
}
