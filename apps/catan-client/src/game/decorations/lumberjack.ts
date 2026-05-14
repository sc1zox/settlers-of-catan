import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { TILE_HEIGHT } from '../tiles/tile';

/**
 * Tiny low-poly lumberjack that swings an axe. Built around a pivot so the
 * arm + axe rotate together about the shoulder.
 */
export class Lumberjack {
  readonly group: Group = new Group();
  private readonly armPivot: Group = new Group();

  constructor() {
    const skin = new MeshStandardMaterial({ color: 0xe8b486, flatShading: true });
    const shirt = new MeshStandardMaterial({ color: 0xb0353a, flatShading: true });
    const pants = new MeshStandardMaterial({ color: 0x3a4a6b, flatShading: true });
    const wood = new MeshStandardMaterial({ color: 0x4a2f1a, flatShading: true });
    const steel = new MeshStandardMaterial({ color: 0xcfcfd4, flatShading: true });

    const legs = new Mesh(new BoxGeometry(0.12, 0.18, 0.08), pants);
    legs.position.y = TILE_HEIGHT + 0.09;
    legs.castShadow = true;
    this.group.add(legs);

    const torso = new Mesh(new BoxGeometry(0.14, 0.18, 0.1), shirt);
    torso.position.y = TILE_HEIGHT + 0.27;
    torso.castShadow = true;
    this.group.add(torso);

    const head = new Mesh(new SphereGeometry(0.07, 8, 6), skin);
    head.position.y = TILE_HEIGHT + 0.43;
    head.castShadow = true;
    this.group.add(head);

    // Arm pivot at the shoulder so the swing rotates the whole arm + axe.
    this.armPivot.position.set(0.07, TILE_HEIGHT + 0.35, 0);
    this.group.add(this.armPivot);

    const arm = new Mesh(new CylinderGeometry(0.025, 0.025, 0.18, 6), skin);
    arm.position.y = -0.09;
    arm.castShadow = true;
    this.armPivot.add(arm);

    const axeHandle = new Mesh(new CylinderGeometry(0.015, 0.015, 0.22, 6), wood);
    axeHandle.position.set(0, -0.2, 0);
    axeHandle.castShadow = true;
    this.armPivot.add(axeHandle);

    const axeHead = new Mesh(new BoxGeometry(0.08, 0.07, 0.02), steel);
    axeHead.position.set(0.05, -0.3, 0);
    axeHead.castShadow = true;
    this.armPivot.add(axeHead);
  }

  /** Swings the axe. Negative angles raise overhead, positive bring it down. */
  update(t: number): void {
    // Asymmetric saw-tooth-ish swing: slow lift, quick chop.
    const period = 1.3;
    const phase = (t % period) / period;
    let angle: number;
    if (phase < 0.7) {
      angle = -1.3 + (phase / 0.7) * 1.3; // lift slowly from -1.3 to 0
    } else {
      angle = ((phase - 0.7) / 0.3) * 1.0; // chop down from 0 to 1.0
    }
    this.armPivot.rotation.x = angle;
  }
}
