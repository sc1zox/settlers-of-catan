import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const MOUND_COUNT = 5;

/**
 * Brickworks landscape: rolling terracotta mounds, a low brick kiln, a
 * neat stack of finished bricks and loose scatter. The kiln's stoking opening
 * glows so the tile reads as a working settlement when viewed from across the
 * table.
 */
export class HillsTile extends Tile {
  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 24036583) ^ (this.coord.r * 14741));

    // Terracotta palette — three shades layered for variety on the mounds.
    const moundDark = new MeshStandardMaterial({
      color: 0x6e3220,
      flatShading: true,
      roughness: 0.95,
    });
    const moundMid = new MeshStandardMaterial({
      color: 0x8a4628,
      flatShading: true,
      roughness: 0.92,
    });
    const moundLight = new MeshStandardMaterial({
      color: 0xa55a36,
      flatShading: true,
      roughness: 0.9,
    });
    const brickMat = new MeshStandardMaterial({
      color: 0xb55a35,
      flatShading: true,
      roughness: 0.85,
    });
    const brickDark = new MeshStandardMaterial({
      color: 0x7a3a22,
      flatShading: true,
      roughness: 0.85,
    });
    const mortarMat = new MeshStandardMaterial({
      color: 0x9c8466,
      flatShading: true,
      roughness: 0.9,
    });
    const beamMat = new MeshStandardMaterial({ color: 0x3a2418, flatShading: true });
    // Glowing kiln mouth — looks like fired bricks even on a flat-lit table.
    const emberMat = new MeshStandardMaterial({
      color: 0xff7a2a,
      emissive: 0xff5510,
      emissiveIntensity: 0.9,
      flatShading: true,
      roughness: 0.5,
    });
    const moundMats = [moundDark, moundMid, moundLight];

    // === Rolling clay mounds — squashed hemispheres for a soft silhouette ===
    const points = scatterInHex(HEX_SIZE * 0.62, MOUND_COUNT, rng);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const w = 0.55 + rng() * 0.35;
      const h = 0.16 + rng() * 0.26;
      const sphereGeom = new SphereGeometry(w * 0.5, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      const mound = new Mesh(sphereGeom, moundMats[Math.floor(rng() * moundMats.length)]);
      mound.position.set(p.x, TILE_HEIGHT - 0.01, p.z);
      mound.scale.set(1, h / (w * 0.5), 1);
      mound.rotation.y = rng() * Math.PI;
      mound.castShadow = true;
      mound.receiveShadow = true;
      this.group.add(mound);

      // A couple of loose bricks decorating the bigger mounds.
      if (w > 0.7) {
        const brickCount = 1 + Math.floor(rng() * 2);
        for (let b = 0; b < brickCount; b++) {
          const brick = new Mesh(
            new BoxGeometry(0.1, 0.04, 0.05),
            rng() > 0.5 ? brickMat : brickDark,
          );
          brick.position.set(
            p.x + (rng() - 0.5) * w * 0.5,
            TILE_HEIGHT + h - 0.01,
            p.z + (rng() - 0.5) * w * 0.5,
          );
          brick.rotation.y = rng() * Math.PI;
          brick.castShadow = true;
          this.group.add(brick);
        }
      }
    }

    // === Brick kiln — a chunky cylinder with mortar band and a glowing mouth.
    const kilnX = -HEX_SIZE * 0.4;
    const kilnZ = HEX_SIZE * 0.32;
    const kilnH = 0.42;
    const kiln = new Mesh(new CylinderGeometry(0.28, 0.32, kilnH, 10), brickMat);
    kiln.position.set(kilnX, TILE_HEIGHT + kilnH / 2, kilnZ);
    kiln.castShadow = true;
    kiln.receiveShadow = true;
    this.group.add(kiln);
    // Mortar band partway up.
    const band = new Mesh(new CylinderGeometry(0.305, 0.305, 0.04, 10), mortarMat);
    band.position.set(kilnX, TILE_HEIGHT + 0.24, kilnZ);
    this.group.add(band);
    // Tapered top.
    const kilnCap = new Mesh(new CylinderGeometry(0.16, 0.24, 0.1, 10), brickDark);
    kilnCap.position.set(kilnX, TILE_HEIGHT + kilnH + 0.05, kilnZ);
    kilnCap.castShadow = true;
    this.group.add(kilnCap);
    // Chimney plug on top of the cap.
    const chimney = new Mesh(new CylinderGeometry(0.08, 0.1, 0.08, 8), brickDark);
    chimney.position.set(kilnX, TILE_HEIGHT + kilnH + 0.14, kilnZ);
    chimney.castShadow = true;
    this.group.add(chimney);
    // Stoking opening — emissive so it looks like coals burning inside.
    const opening = new Mesh(new BoxGeometry(0.04, 0.13, 0.16), emberMat);
    opening.position.set(kilnX + 0.27, TILE_HEIGHT + 0.13, kilnZ);
    this.group.add(opening);
    // Wooden lintel above the opening.
    const lintel = new Mesh(new BoxGeometry(0.04, 0.04, 0.22), beamMat);
    lintel.position.set(kilnX + 0.27, TILE_HEIGHT + 0.22, kilnZ);
    lintel.castShadow = true;
    this.group.add(lintel);

    // === Stack of finished bricks — staggered rows like a real brick pile.
    const stackX = HEX_SIZE * 0.45;
    const stackZ = -HEX_SIZE * 0.05;
    const stackAngle = -0.5;
    const stackRows = 4;
    const stackCols = 3;
    const brickW = 0.16;
    const brickH = 0.06;
    const brickD = 0.08;
    const cosA = Math.cos(stackAngle);
    const sinA = Math.sin(stackAngle);
    for (let r = 0; r < stackRows; r++) {
      const offsetThisRow = (r % 2) * brickW * 0.5;
      for (let c = 0; c < stackCols; c++) {
        const localX = (c - 1) * brickW + offsetThisRow;
        const xx = stackX + cosA * localX;
        const zz = stackZ + sinA * localX;
        const brick = new Mesh(
          new BoxGeometry(brickW * 0.95, brickH, brickD),
          r % 2 === 0 ? brickMat : brickDark,
        );
        brick.position.set(xx, TILE_HEIGHT + brickH / 2 + r * brickH, zz);
        brick.rotation.y = stackAngle;
        brick.castShadow = true;
        brick.receiveShadow = true;
        this.group.add(brick);
      }
    }

    // === Loose bricks scattered around, skipping the kiln and stack footprints.
    const loose = scatterInHex(HEX_SIZE * 0.78, 7, rng);
    for (const p of loose) {
      if (Math.hypot(p.x - kilnX, p.z - kilnZ) < 0.55) continue;
      if (Math.hypot(p.x - stackX, p.z - stackZ) < 0.45) continue;
      const brick = new Mesh(
        new BoxGeometry(0.13, 0.05, 0.07),
        rng() > 0.5 ? brickMat : brickDark,
      );
      brick.position.set(p.x, TILE_HEIGHT + 0.025, p.z);
      brick.rotation.y = rng() * Math.PI;
      brick.rotation.z = (rng() - 0.5) * 0.25;
      brick.castShadow = true;
      brick.receiveShadow = true;
      this.group.add(brick);
    }
  }
}
