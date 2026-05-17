import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Sprite,
  Vector3,
} from 'three';
import { AxialCoord, HEX_SIZE } from '../board/hex';
import { TILE_COLOR, TileType } from '@catan/shared-game-field';
import { NumberBalloon } from './number-balloon';
import { TILE_HEIGHT, WATER_LEVEL_Y } from './tile-metrics';

export { CHIP_FLOAT_Y, TILE_HEIGHT, WATER_LEVEL_Y } from './tile-metrics';

export interface TileInit {
  readonly coord: AxialCoord;
  readonly type: TileType;
  readonly position: Vector3;
  readonly number: number | null;
}

/**
 * Base for one hex on the board. Subclasses add decorations and animation,
 * and must call `super.update(dt, t)` to keep the number balloon bobbing.
 */
export abstract class Tile {
  readonly group: Group = new Group();
  readonly coord: AxialCoord;
  readonly type: TileType;
  readonly number: number | null;
  /** Becomes true when a player has built adjacent. */
  settled = false;

  private readonly numberBalloon: NumberBalloon | null;

  constructor(init: TileInit) {
    this.coord = init.coord;
    this.type = init.type;
    this.number = init.number;
    this.group.position.copy(init.position);
    this.buildBase();
    this.buildOutline();
    if (init.number !== null) {
      this.numberBalloon = new NumberBalloon(this.group, {
        value: init.number,
        coord: this.coord,
        tile: this,
      });
    } else {
      this.numberBalloon = null;
    }
  }

  private buildBase(): void {
    const slabHeight = TILE_HEIGHT - WATER_LEVEL_Y + 2.0;
    const geom = new CylinderGeometry(HEX_SIZE, HEX_SIZE, slabHeight, 6, 1);
    const mat = new MeshStandardMaterial({
      color: TILE_COLOR[this.type],
      flatShading: true,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new Mesh(geom, mat);
    mesh.position.y = TILE_HEIGHT - slabHeight / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildOutline(): void {
    const points: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const theta = (i / 6) * Math.PI * 2;
      points.push(HEX_SIZE * Math.sin(theta), TILE_HEIGHT + 0.01, HEX_SIZE * Math.cos(theta));
    }
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(points, 3));
    const mat = new LineBasicMaterial({ color: 0x1d130a, transparent: true, opacity: 0.55 });
    this.group.add(new Line(geom, mat));
  }

  public getChipSprite(): Sprite | null {
    return this.numberBalloon?.getPickSprite() ?? null;
  }

  public setChipHovered(hovered: boolean): void {
    this.numberBalloon?.setPointerHovered(hovered);
  }

  public setRolledChipHighlighted(active: boolean): void {
    this.numberBalloon?.setRolledHighlighted(active);
  }

  public update(dt: number, t: number): void {
    this.numberBalloon?.update(dt, t);
  }

  public dispose(): void {
    this.numberBalloon?.dispose();
    this.group.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        const list = Array.isArray(mat) ? mat : [mat];
        for (const m of list) m.dispose();
      }
      if (obj instanceof Line) {
        obj.geometry.dispose();
        const m = obj.material;
        if (!Array.isArray(m)) m.dispose();
      }
    });
  }
}
