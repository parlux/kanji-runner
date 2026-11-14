// The only door to the WebGL layer for code outside `game/`.
export type { View3d } from "./three/scene3d";
export const loadScene3d = () => import("./three/scene3d");
