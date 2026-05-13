import { ConeGeometry, Mesh, MeshStandardMaterial } from 'three';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Mine } from '../decorations/mine';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const PEAK_COUNT = 4;

export class MountainsTile extends Tile {
  private readonly mine: Mine;

  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 12582917) ^ (this.coord.r * 5099));

    const rockMat = new MeshStandardMaterial({ color: 0x6c6f76, flatShading: true });
    const snowMat = new MeshStandardMaterial({ color: 0xf2f3f5, flatShading: true });

    const points = scatterInHex(HEX_SIZE * 0.55, PEAK_COUNT, rng);
    for (const p of points) {
      const h = 0.55 + rng() * 0.45;
      const r = 0.3 + rng() * 0.15;
      const peak = new Mesh(new ConeGeometry(r, h, 5), rockMat);
      peak.castShadow = true;
      peak.receiveShadow = true;
      peak.position.set(p.x, TILE_HEIGHT + h / 2, p.z);
      peak.rotation.y = rng() * Math.PI;
      this.group.add(peak);
      if (h > 0.85) {
        const capH = 0.18;
        const cap = new Mesh(new ConeGeometry(r * 0.45, capH, 5), snowMat);
        cap.castShadow = true;
        cap.position.set(p.x, TILE_HEIGHT + h - capH / 2 - 0.02, p.z);
        cap.rotation.y = peak.rotation.y;
        this.group.add(cap);
      }
    }

    this.mine = new Mine();
    this.mine.group.position.set(HEX_SIZE * 0.4, 0, HEX_SIZE * 0.4);
    this.mine.group.rotation.y = Math.PI * 0.75;
    this.mine.group.visible = false;
    this.group.add(this.mine.group);
  }

  override update(dt: number, t: number): void {
    super.update(dt, t);
    this.mine.group.visible = this.settled;
    if (this.settled) this.mine.update(t);
  }
}
