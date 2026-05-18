import { Euler, Group, Object3D, Quaternion, Vector3 } from 'three';
import { BuildKind, SceneObjectKind, SceneUserDataKey } from '@catan/api-interfaces';
import {
  createFigureMaterials,
  disposeFigureMaterials,
  makeCity,
  makeRoad,
  makeSettlement,
  PlayerFigureMaterials,
} from './figures';
import {
  ARSENAL_BOB_AMPLITUDE,
  ARSENAL_FLIGHT_ARC,
  ARSENAL_FLIGHT_DURATION,
  ARSENAL_LIFT_HEIGHT,
  ARSENAL_LIFT_SCALE,
  ARSENAL_SWAY_ANGLE,
} from './player-area-constants';
import { PlayerColor } from './colors';
import { PresenceMaterialDimmer } from './presence-material-dimmer';

export interface PlayerAreaArsenalOptions {
  readonly group: Group;
  readonly color: PlayerColor;
  readonly tableTopY: number;
  readonly innerEdgeZ: number;
}

export interface ArsenalPlacedPieces {
  readonly settlements: number;
  readonly cities: number;
  readonly roads: number;
}

export class PlayerAreaArsenal {
  private readonly figureMats: PlayerFigureMaterials;
  private readonly arsenalFigures: Object3D[] = [];
  private readonly figuresByKind: Record<BuildKind, Object3D[]> = {
    [BuildKind.Settlement]: [],
    [BuildKind.City]: [],
    [BuildKind.Road]: [],
  };
  private readonly presenceDimmer = new PresenceMaterialDimmer();

  private activatedFigure: Object3D | null = null;
  private readonly activatedBasePos = new Vector3();
  private readonly activatedBaseRot = new Euler();
  private readonly activatedBaseScale = new Vector3();
  private activatedTarget = 0;
  private activatedT = 0;
  private activatedSwayT = 0;

  private flyingFigure: Object3D | null = null;
  private flying = false;
  private flightT = 0;
  private readonly flightStartPos = new Vector3();
  private readonly flightStartQuat = new Quaternion();
  private readonly flightStartScale = new Vector3();
  private readonly flightTargetPos = new Vector3();
  private readonly flightTargetQuat = new Quaternion();
  private readonly flightTargetScale = new Vector3();
  private readonly flightScratchQuat = new Quaternion();
  private flightOnArrive: (() => void) | null = null;

  public constructor(private readonly options: PlayerAreaArsenalOptions) {
    this.figureMats = createFigureMaterials(options.color);
    const arsenalZ = options.innerEdgeZ + 0.9;
    this.layoutRoads(arsenalZ - 0.35, options.tableTopY);
    this.layoutSettlements(arsenalZ + 0.1, options.tableTopY);
    this.layoutCities(arsenalZ + 0.1, options.tableTopY);
    this.presenceDimmer.register([
      this.figureMats.body,
      this.figureMats.accent,
      this.figureMats.dark,
    ]);
  }

  public setPresenceDimmed(dimmed: boolean): void {
    this.presenceDimmer.setDimmed(dimmed);
  }

  public get arsenal(): readonly Object3D[] {
    return this.arsenalFigures;
  }

  public setActivatedArsenalFigure(figure: Object3D | null): void {
    if (figure === null) {
      this.activatedTarget = 0;
      return;
    }
    if (figure === this.flyingFigure) {
      return;
    }
    if (figure === this.activatedFigure) {
      this.activatedTarget = 1;
      return;
    }
    if (this.activatedFigure !== null) {
      this.restoreActivatedFigure();
    }
    this.activatedFigure = figure;
    this.activatedBasePos.copy(figure.position);
    this.activatedBaseRot.copy(figure.rotation);
    this.activatedBaseScale.copy(figure.scale);
    this.activatedT = 0;
    this.activatedSwayT = 0;
    this.activatedTarget = 1;
  }

  public hasActivatedArsenalFigure(kind: BuildKind): boolean {
    return (
      this.activatedFigure !== null &&
      this.activatedFigure.userData[SceneUserDataKey.BuildKind] === kind
    );
  }

  public hasAvailableArsenalFigure(kind: BuildKind): boolean {
    return this.pickAvailableArsenalFigure(kind) !== null;
  }

  public flyActivatedFigureToWorld(
    worldPosition: Vector3,
    worldQuaternion: Quaternion,
    worldScale: Vector3,
    onArrive: () => void,
  ): void {
    const figure = this.activatedFigure;
    if (figure === null) {
      onArrive();
      return;
    }
    this.activatedFigure = null;
    this.activatedTarget = 0;
    this.activatedT = 0;
    this.startFlight(figure, worldPosition, worldQuaternion, worldScale, onArrive);
  }

  /**
   * Pick any still-available arsenal figure of the requested kind and fly it
   * to the world target. Used when a remote player places a piece so every
   * viewer sees the figure leave that player's arsenal rather than just
   * popping in at the destination. Returns false when the arsenal has no
   * figure left to fly (caller should then reveal the piece immediately).
   */
  public flyArsenalFigureOfKindToWorld(
    kind: BuildKind,
    worldPosition: Vector3,
    worldQuaternion: Quaternion,
    worldScale: Vector3,
    onArrive: () => void,
  ): boolean {
    const figure = this.pickAvailableArsenalFigure(kind);
    if (figure === null) {
      onArrive();
      return false;
    }
    this.startFlight(figure, worldPosition, worldQuaternion, worldScale, onArrive);
    return true;
  }

  private pickAvailableArsenalFigure(kind: BuildKind): Object3D | null {
    const figures = this.figuresByKind[kind];
    for (let i = 0; i < figures.length; i += 1) {
      const figure = figures[i];
      if (figure === this.flyingFigure) continue;
      if (figure === this.activatedFigure) continue;
      if (!figure.visible) continue;
      return figure;
    }
    return null;
  }

  private startFlight(
    figure: Object3D,
    worldPosition: Vector3,
    worldQuaternion: Quaternion,
    worldScale: Vector3,
    onArrive: () => void,
  ): void {
    this.flyingFigure = figure;
    figure.visible = true;

    this.flightStartPos.copy(figure.position);
    this.flightStartQuat.copy(figure.quaternion);
    this.flightStartScale.copy(figure.scale);

    const group = this.options.group;
    group.updateWorldMatrix(true, false);
    this.flightTargetPos.copy(worldPosition);
    group.worldToLocal(this.flightTargetPos);
    group.getWorldQuaternion(this.flightScratchQuat).invert();
    this.flightTargetQuat.copy(this.flightScratchQuat).multiply(worldQuaternion);
    this.flightTargetScale.copy(worldScale);

    this.flightT = 0;
    this.flying = true;
    this.flightOnArrive = onArrive;
  }

  public update(dt: number): void {
    this.updateActivatedFigure(dt);
    this.updateFlight(dt);
  }

  public dispose(): void {
    disposeFigureMaterials(this.figureMats);
  }

  private updateFlight(dt: number): void {
    const figure = this.flyingFigure;
    if (!this.flying || figure === null) return;

    this.flightT = Math.min(1, this.flightT + dt / ARSENAL_FLIGHT_DURATION);
    const t = this.flightT;
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;

    figure.position.lerpVectors(this.flightStartPos, this.flightTargetPos, eased);
    figure.position.y += Math.sin(t * Math.PI) * ARSENAL_FLIGHT_ARC;
    figure.quaternion.slerpQuaternions(this.flightStartQuat, this.flightTargetQuat, eased);
    figure.scale.lerpVectors(this.flightStartScale, this.flightTargetScale, eased);

    if (t >= 1) {
      figure.position.copy(this.flightTargetPos);
      figure.quaternion.copy(this.flightTargetQuat);
      figure.scale.copy(this.flightTargetScale);
      figure.visible = false;
      this.flying = false;
      this.flyingFigure = null;
      const onArrive = this.flightOnArrive;
      this.flightOnArrive = null;
      onArrive?.();
    }
  }

  private restoreActivatedFigure(): void {
    const figure = this.activatedFigure;
    if (figure === null) return;
    figure.position.copy(this.activatedBasePos);
    figure.rotation.copy(this.activatedBaseRot);
    figure.scale.copy(this.activatedBaseScale);
  }

  private updateActivatedFigure(dt: number): void {
    const figure = this.activatedFigure;
    if (figure === null) return;

    this.activatedT += (this.activatedTarget - this.activatedT) * Math.min(1, dt * 9);
    this.activatedSwayT += dt;

    if (this.activatedTarget === 0 && this.activatedT < 0.002) {
      this.restoreActivatedFigure();
      this.activatedFigure = null;
      return;
    }

    const e = this.activatedT;
    const lift = 1 - (1 - e) * (1 - e);
    const swayT = this.activatedSwayT;

    const bob = Math.sin(swayT * 2.3) * ARSENAL_BOB_AMPLITUDE * e;
    figure.position.set(
      this.activatedBasePos.x,
      this.activatedBasePos.y + ARSENAL_LIFT_HEIGHT * lift + bob,
      this.activatedBasePos.z,
    );
    figure.rotation.set(
      this.activatedBaseRot.x + Math.sin(swayT * 1.7) * ARSENAL_SWAY_ANGLE * e,
      this.activatedBaseRot.y + Math.sin(swayT * 0.8) * ARSENAL_SWAY_ANGLE * 0.9 * e,
      this.activatedBaseRot.z + Math.cos(swayT * 1.3) * ARSENAL_SWAY_ANGLE * e,
    );
    const scale = 1 + (ARSENAL_LIFT_SCALE - 1) * e;
    figure.scale.set(
      this.activatedBaseScale.x * scale,
      this.activatedBaseScale.y * scale,
      this.activatedBaseScale.z * scale,
    );
  }

  private tagArsenalFigure(figure: Object3D, buildKind: BuildKind): void {
    figure.userData[SceneUserDataKey.Kind] = SceneObjectKind.Arsenal;
    figure.userData[SceneUserDataKey.BuildKind] = buildKind;
    this.arsenalFigures.push(figure);
    this.figuresByKind[buildKind].push(figure);
  }

  /**
   * Reconcile arsenal visibility against server-authoritative placement counts.
   * Idempotent — call on every full-state apply. The currently flying figure is
   * left alone so the flight controls its own arrival visibility.
   */
  public setPlacedPieces(placed: ArsenalPlacedPieces): void {
    this.applyKindPlaced(BuildKind.Settlement, placed.settlements);
    this.applyKindPlaced(BuildKind.City, placed.cities);
    this.applyKindPlaced(BuildKind.Road, placed.roads);
  }

  private applyKindPlaced(kind: BuildKind, placed: number): void {
    const figures = this.figuresByKind[kind];
    const remaining = Math.max(0, figures.length - placed);
    let visibleSoFar = 0;
    for (let i = 0; i < figures.length; i += 1) {
      const figure = figures[i];
      if (figure === this.flyingFigure) {
        continue;
      }
      const shouldBeVisible = visibleSoFar < remaining;
      figure.visible = shouldBeVisible;
      if (shouldBeVisible) {
        visibleSoFar += 1;
      }
    }
  }

  private layoutRoads(centreZ: number, tableY: number): void {
    const group = this.options.group;
    const startX = -7.0;
    const colStep = 0.7;
    const rowStep = 0.3;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const road = makeRoad(this.figureMats);
        road.position.set(startX + col * colStep, tableY + 0.005, centreZ + (row - 1) * rowStep);
        road.rotation.y = (row * 5 + col) * 0.13 - 0.3;
        this.tagArsenalFigure(road, BuildKind.Road);
        group.add(road);
      }
    }
  }

  private layoutSettlements(centreZ: number, tableY: number): void {
    const group = this.options.group;
    const startX = -2.5;
    const step = 0.55;
    for (let i = 0; i < 5; i++) {
      const s = makeSettlement(this.figureMats);
      s.position.set(startX + i * step, tableY + 0.005, centreZ - 0.1);
      s.rotation.y = i * 0.21 - 0.4;
      this.tagArsenalFigure(s, BuildKind.Settlement);
      group.add(s);
    }
  }

  private layoutCities(centreZ: number, tableY: number): void {
    const group = this.options.group;
    const startX = 0.6;
    const step = 0.72;
    for (let i = 0; i < 4; i++) {
      const c = makeCity(this.figureMats);
      c.position.set(startX + i * step, tableY + 0.005, centreZ - 0.05);
      c.rotation.y = i * 0.18 - 0.27;
      this.tagArsenalFigure(c, BuildKind.City);
      group.add(c);
    }
  }
}
