import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Shape,
  type Scene,
} from "three";
import { hazardPos, isShattered, type RunState } from "../../core/sim";
import {
  CRATE_D,
  CRATE_H,
  sawPlace,
  shapeDistance,
  spanWorld,
  WALL_BEHIND,
  worldZ,
} from "./world";

/**
 * The run's crates (blocks) and saws in 3D. Crates are wooden boxes whose top
 * is eaten away by damage, flashing while hit; saws are toothed discs
 * spinning on a rail, where the sim has them. Props, not figures: shared
 * geometry and materials, instanced, nothing allocated per frame.
 */

const MAX_CRATES = 10;
const MAX_SAWS = 10;
const CRATE = { wood: 0xc08a4a, band: 0xf0c27a, dark: 0x3a2616 } as const;
const BAND_H = 0.12;
/** The dark slab and bands stand this far proud of the crate's faces, so they never z-fight. */
const PROUD = 0.03;
const SAW = { disc: 0xff5a4a, hub: 0xfff0e0, rail: 0xc24b4b } as const;
const TEETH = 10;
const SAW_THICK = 0.2;
const RAIL_H = 0.12;
const RAIL_D = 0.3;
/** Radians the saw spins per unit of track distance. */
const SAW_SPIN = 14;
/** How much a hit crate whitens when it flashes. */
const FLASH = 0.55;

/** A unit-radius toothed disc facing +Z. */
function sawGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  for (let k = 0; k < TEETH * 2; k++) {
    const a = (k * Math.PI) / TEETH;
    const r = k % 2 ? 0.78 : 1;
    if (k === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a));
    else shape.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  shape.closePath();
  const g = new ExtrudeGeometry(shape, {
    depth: SAW_THICK,
    bevelEnabled: false,
  });
  g.translate(0, 0, -SAW_THICK / 2);
  return g;
}

export function createProps(scene: Scene) {
  const box = new BoxGeometry(1, 1, 1);
  const lambert = (colour: number): MeshLambertMaterial =>
    new MeshLambertMaterial({ color: colour });
  const crates = new InstancedMesh(box, lambert(0xffffff), MAX_CRATES);
  const bands = new InstancedMesh(box, lambert(CRATE.band), MAX_CRATES * 2);
  const slabs = new InstancedMesh(box, lambert(CRATE.dark), MAX_CRATES);
  const discs = new InstancedMesh(sawGeometry(), lambert(SAW.disc), MAX_SAWS);
  const hubGeo = new CylinderGeometry(0.22, 0.22, SAW_THICK + 0.1, 10);
  hubGeo.rotateX(Math.PI / 2);
  const hubs = new InstancedMesh(hubGeo, lambert(SAW.hub), MAX_SAWS);
  const rails = new InstancedMesh(box, lambert(SAW.rail), MAX_SAWS);
  const all = [crates, bands, slabs, discs, hubs, rails];
  for (const mesh of all) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const m = new Matrix4();
  const spin = new Matrix4();
  const wood = new Color(CRATE.wood);
  const white = new Color(0xffffff);
  const c = new Color();

  return {
    /** Places the visible crates and saws for the run as it is now. */
    update(run: RunState) {
      let nc = 0;
      let nb = 0;
      let nd = 0;
      let ns = 0;
      const { hazards } = run.track;
      for (let i = hazards.length - 1; i >= 0; i--) {
        const h = hazards[i];
        if (!h || h.kind === "pack") continue;
        const ahead = hazardPos(run, i) - run.dist;
        if (ahead < -WALL_BEHIND) break;
        // never beyond the shape horizon
        if (ahead > shapeDistance()) continue;
        const z = worldZ(h.pos, run.dist);
        if (h.kind === "block") {
          if (isShattered(run, i) || nc >= MAX_CRATES) continue;
          const { x, w } = spanWorld(h.left, h.right);
          const cz = z - CRATE_D / 2;
          m.makeScale(w, CRATE_H, CRATE_D).setPosition(x, CRATE_H / 2, cz);
          crates.setMatrixAt(nc, m);
          // a hit crate flashes
          const hit = run.target === i && Math.floor(run.dist * 40) % 2 === 0;
          crates.setColorAt(nc, c.copy(wood).lerp(white, hit ? FLASH : 0));
          nc++;
          for (const y of [BAND_H / 2, CRATE_H - BAND_H / 2]) {
            m.makeScale(w + 2 * PROUD, BAND_H, CRATE_D + 2 * PROUD).setPosition(
              x,
              y,
              cz,
            );
            bands.setMatrixAt(nb++, m);
          }
          // damage eats the crate from the top down
          const hp = run.hp[i] ?? 0;
          const dmg = run.damage[i] ?? 0;
          if (hp > 0 && dmg > 0) {
            const hh = CRATE_H * Math.min(1, dmg / hp);
            m.makeScale(w + 4 * PROUD, hh, CRATE_D + 4 * PROUD).setPosition(
              x,
              CRATE_H - hh / 2,
              cz,
            );
            slabs.setMatrixAt(nd++, m);
          }
        } else if (ns < MAX_SAWS) {
          const p = sawPlace(h, run.dist);
          m.makeScale(p.railW, RAIL_H, RAIL_D).setPosition(
            p.railX,
            RAIL_H / 2,
            z,
          );
          rails.setMatrixAt(ns, m);
          m.makeScale(p.r, p.r, 1).setPosition(p.x, RAIL_H + p.r, z);
          spin.makeRotationZ(run.dist * SAW_SPIN);
          // spin about the disc's own centre, then place it
          m.multiply(spin);
          discs.setMatrixAt(ns, m);
          m.makeTranslation(p.x, RAIL_H + p.r, z);
          hubs.setMatrixAt(ns++, m);
        }
      }
      crates.count = nc;
      bands.count = nb;
      slabs.count = nd;
      discs.count = ns;
      hubs.count = ns;
      rails.count = ns;
      for (const mesh of all) mesh.instanceMatrix.needsUpdate = true;
      if (crates.instanceColor) crates.instanceColor.needsUpdate = true;
    },
  };
}
