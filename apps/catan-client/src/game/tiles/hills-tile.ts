import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { createRng, scatterInHex } from '../animation/rng';
import { HEX_SIZE } from '../board/hex';
import { Tile, TileInit, TILE_HEIGHT } from './tile';

const MOUND_COUNT = 5;

export class HillsTile extends Tile {
  constructor(init: TileInit) {
    super(init);
    const rng = createRng((this.coord.q * 24036583) ^ (this.coord.r * 14741));

    const moundMat = new MeshStandardMaterial({ color: 0x8a4a2a, flatShading: true });
    const brickMat = new MeshStandardMaterial({ color: 0xb55a35, flatShading: true });

    const points = scatterInHex(HEX_SIZE * 0.6, MOUND_COUNT, rng);
    for (const p of points) {
      const w = 0.25 + rng() * 0.2;
      const h = 0.14 + rng() * 0.18;
      const d = 0.25 + rng() * 0.2;
      const mound = new Mesh(new BoxGeometry(w, h, d), moundMat);
      mound.castShadow = true;
      mound.receiveShadow = true;
      mound.position.set(p.x, TILE_HEIGHT + h / 2, p.z);
      mound.rotation.y = rng() * Math.PI;
      this.group.add(mound);
      // A few bricks on top.
      const brickCount = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < brickCount; i++) {
        const brick = new Mesh(new BoxGeometry(0.09, 0.04, 0.05), brickMat);
        brick.castShadow = true;
        brick.position.set(
          p.x + (rng() - 0.5) * w * 0.6,
          TILE_HEIGHT + h + 0.02,
          p.z + (rng() - 0.5) * d * 0.6,
        );
        brick.rotation.y = rng() * Math.PI;
        this.group.add(brick);
      }
    }
  }
}
