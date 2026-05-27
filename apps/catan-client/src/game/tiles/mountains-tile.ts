import { ConeGeometry, IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Mine } from '../decorations/mine';
import { runtimeFlags } from '../engine-runtime/runtime-flags';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const PEAK_CLUSTER_COUNT = 3;
const BOULDER_COUNT = 7;

/**
 * Jagged stone hex: each "peak" is a small cluster of cones at different
 * heights so the mountains read as broken ridges rather than single spikes.
 * Loose boulders ring the base and a small ore vein hints at the resource.
 */
export class MountainsTile extends Tile {
  private readonly mine: Mine;

  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 12582917) ^ (this.coord.r * 5099));

    const rockDark = new MeshStandardMaterial({
      color: 0x4f5159,
      flatShading: true,
      roughness: 0.95,
    });
    const rockMid = new MeshStandardMaterial({
      color: 0x6c6f76,
      flatShading: true,
      roughness: 0.92,
    });
    const rockLight = new MeshStandardMaterial({
      color: 0x868a91,
      flatShading: true,
      roughness: 0.9,
    });
    const snowMat = new MeshStandardMaterial({
      color: 0xf2f3f5,
      flatShading: true,
      roughness: 0.95,
    });
    // Ore — warm metallic with a subtle glow so it's visible even on flat lighting.
    const oreMat = new MeshStandardMaterial({
      color: 0xc7a14a,
      emissive: 0x6a4818,
      emissiveIntensity: 0.45,
      flatShading: true,
      roughness: 0.55,
      metalness: 0.55,
    });
    const rockMats = [rockDark, rockMid, rockLight];

    // === Peak clusters — 2-4 cones per cluster, varying heights and tilt ===
    const clusterCentres = scatterInHex(HEX_SIZE * 0.45, PEAK_CLUSTER_COUNT, rng);
    for (let cIdx = 0; cIdx < clusterCentres.length; cIdx++) {
      const c = clusterCentres[cIdx];
      const peakCount = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < peakCount; i++) {
        const offX = (rng() - 0.5) * 0.42;
        const offZ = (rng() - 0.5) * 0.42;
        const h = 0.55 + rng() * 0.55;
        const r = 0.22 + rng() * 0.18;
        const sides = 5 + Math.floor(rng() * 2);
        const mat = rockMats[Math.floor(rng() * rockMats.length)];
        const peak = new Mesh(new ConeGeometry(r, h, sides), mat);
        peak.castShadow = true;
        peak.receiveShadow = true;
        peak.position.set(c.x + offX, TILE_HEIGHT + h / 2, c.z + offZ);
        // Small tilt so the ridges don't look factory-made.
        peak.rotation.y = rng() * Math.PI;
        peak.rotation.x = (rng() - 0.5) * 0.14;
        peak.rotation.z = (rng() - 0.5) * 0.14;
        this.group.add(peak);
        if (h > 0.85) {
          const capH = 0.2;
          const cap = new Mesh(new ConeGeometry(r * 0.5, capH, sides), snowMat);
          cap.castShadow = true;
          cap.position.set(c.x + offX, TILE_HEIGHT + h - capH / 2 - 0.03, c.z + offZ);
          cap.rotation.copy(peak.rotation);
          this.group.add(cap);
        }
      }
    }

    // === Boulders ring the base — squashed icosahedrons read as chunky rocks ===
    const boulderPoints = scatterInHex(HEX_SIZE * 0.78, BOULDER_COUNT, rng);
    for (const p of boulderPoints) {
      const size = 0.13 + rng() * 0.17;
      const boulder = new Mesh(
        new IcosahedronGeometry(size, 0),
        rockMats[Math.floor(rng() * rockMats.length)],
      );
      boulder.position.set(p.x, TILE_HEIGHT + size * 0.55, p.z);
      boulder.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      boulder.scale.y = 0.7;
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.group.add(boulder);
    }

    // === Ore vein — three angular crystals on the rim ===
    const oreX = -HEX_SIZE * 0.5;
    const oreZ = -HEX_SIZE * 0.35;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + rng() * 0.6;
      const h = 0.18 + rng() * 0.12;
      const crystal = new Mesh(new ConeGeometry(0.07, h, 4), oreMat);
      crystal.position.set(
        oreX + Math.cos(angle) * 0.08,
        TILE_HEIGHT + h / 2,
        oreZ + Math.sin(angle) * 0.08,
      );
      crystal.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI, (rng() - 0.5) * 0.4);
      crystal.castShadow = true;
      this.group.add(crystal);
    }
    // Small scree pile around the ore vein.
    for (let i = 0; i < 3; i++) {
      const r = 0.05 + rng() * 0.04;
      const scree = new Mesh(new IcosahedronGeometry(r, 0), rockDark);
      scree.position.set(
        oreX + (rng() - 0.5) * 0.3,
        TILE_HEIGHT + r * 0.55,
        oreZ + (rng() - 0.5) * 0.3,
      );
      scree.rotation.set(rng(), rng(), rng());
      scree.scale.y = 0.7;
      scree.castShadow = true;
      this.group.add(scree);
    }

    // === Mine entrance — pinned at a corner of the tile, oriented so the
    // cave faces outward and the cart drives straight in/out along that axis.
    const mineX = HEX_SIZE * 0.4;
    const mineZ = HEX_SIZE * 0.4;
    const mineRot = Math.PI * 0.75;

    // Always-visible mountain mass directly behind / around the entrance, so
    // the cave is clearly set INTO a mountain even on unsettled tiles. We
    // place these in the tile group (not in `mine.group`) because that group
    // is toggled off when the tile isn't settled.
    const cosMR = Math.cos(mineRot);
    const sinMR = Math.sin(mineRot);
    // Transform a point in the mine's local XZ frame into the tile's world
    // XZ frame (matches the same Y-rotation the mine group applies).
    const localToTile = (lx: number, lz: number) => ({
      x: mineX + lx * cosMR + lz * sinMR,
      z: mineZ - lx * sinMR + lz * cosMR,
    });

    // Main backdrop peak — tall, snow-capped, directly behind the entrance.
    {
      const peakCentre = localToTile(0, -0.34);
      const h = 1.05;
      const r = 0.42;
      const peak = new Mesh(new ConeGeometry(r, h, 6), rockMid);
      peak.position.set(peakCentre.x, TILE_HEIGHT + h / 2, peakCentre.z);
      peak.rotation.y = mineRot + 0.2;
      peak.castShadow = true;
      peak.receiveShadow = true;
      this.group.add(peak);
      const capH = 0.26;
      const cap = new Mesh(new ConeGeometry(r * 0.45, capH, 6), snowMat);
      cap.position.set(peakCentre.x, TILE_HEIGHT + h - capH / 2 - 0.04, peakCentre.z);
      cap.rotation.y = peak.rotation.y;
      cap.castShadow = true;
      this.group.add(cap);
    }

    // Flanking shoulders on each side of the entrance — wide rocks so the
    // entrance looks like it was cut into the mountain face, not stuck onto
    // a flat tile.
    for (const side of [-1, 1]) {
      const flankCentre = localToTile(side * 0.34, -0.1);
      const flank = new Mesh(new IcosahedronGeometry(0.28, 0), rockDark);
      flank.position.set(flankCentre.x, TILE_HEIGHT + 0.19, flankCentre.z);
      flank.rotation.set(side * 0.4, side * 0.7 + mineRot, 0.25);
      flank.scale.y = 0.85;
      flank.castShadow = true;
      flank.receiveShadow = true;
      this.group.add(flank);
    }

    this.mine = new Mine();
    this.mine.group.position.set(mineX, 0, mineZ);
    this.mine.group.rotation.y = mineRot;
    this.mine.group.visible = false;
    this.group.add(this.mine.group);
  }

  override update(dt: number, t: number): void {
    super.update(dt, t);
    if (!runtimeFlags.ambientAnimationsEnabled) {
      this.mine.group.visible = false;
      return;
    }
    this.mine.group.visible = this.settled;
    if (this.settled) this.mine.update(t);
  }
}
