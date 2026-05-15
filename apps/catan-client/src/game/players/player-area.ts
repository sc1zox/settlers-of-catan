import { Euler, Group, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { AvatarKind, BuildKind, SceneObjectKind, SceneUserDataKey } from '@catan/api-interfaces';
import { Card } from '../cards/card';
import { createCostCard } from '../cards/cost-card';
import {
  DevKind,
  ResourceKind,
  makeDevBackTexture,
  makeResourceBackTexture,
  makeResourceFaceTexture,
} from '../cards/textures';
import { CardHoverGroup } from '../shared/card-hover';
import { PlayerColor, playerColorLabel } from './colors';
import {
  createFigureMaterials,
  disposeFigureMaterials,
  makeCity,
  makeRoad,
  makeSettlement,
  PlayerFigureMaterials,
} from './figures';
import { AvatarSeat } from './avatar-seat';

export interface PlayerAreaInfo {
  readonly seat: number;
  readonly color: PlayerColor;
  readonly name: string;
}

export interface PlayerAreaOptions {
  readonly color: PlayerColor;
  readonly seat: 0 | 1 | 2 | 3;
  readonly tableTopY: number;
  /** Strip starts (closer to disc) at this local Z. */
  readonly innerEdgeZ: number;
  /** Strip ends (closer to player edge) at this local Z. */
  readonly outerEdgeZ: number;
  readonly resourceHand: readonly ResourceKind[];
  readonly devHand: readonly DevKind[];
}

const CARD_LONG = 0.95;
const CARD_SHORT = 0.65;
const CARD_THICKNESS = 0.035;
const HAND_GAP = 0.18;

/** Fixed left-to-right order so a resource card keeps its slot across deals. */
const RESOURCE_DISPLAY_ORDER: readonly ResourceKind[] = [
  ResourceKind.Wood,
  ResourceKind.Brick,
  ResourceKind.Grain,
  ResourceKind.Wool,
  ResourceKind.Ore,
];

/** Height a freshly dealt card drops in from. */
const DEAL_DROP_HEIGHT = 1.7;
const DEAL_LATERAL_JITTER = 0.45;

/** How far above its arsenal slot an "activated" build figure floats. */
const ARSENAL_LIFT_HEIGHT = 1.15;
/** Size multiplier reached at full lift, so the picked figure reads clearly. */
const ARSENAL_LIFT_SCALE = 1.3;
/** Vertical bob amplitude of a floating figure. */
const ARSENAL_BOB_AMPLITUDE = 0.06;
/** Peak sway angle (radians) of the dangling figure. */
const ARSENAL_SWAY_ANGLE = 0.16;
/** Seconds an arsenal figure takes to fly from the stash onto the board. */
const ARSENAL_FLIGHT_DURATION = 0.6;
/** Peak height of the lob arc the flying figure follows. */
const ARSENAL_FLIGHT_ARC = 1.4;

export class PlayerArea {
  readonly group: Group = new Group();
  readonly info: PlayerAreaInfo;

  private readonly figureMats: PlayerFigureMaterials;
  /** Permanent materials (arsenal + cost card) — disposed in dispose(). */
  private readonly ownedMaterials: MeshStandardMaterial[] = [];
  /** Materials backing the current dynamic hand — rebuilt on every setHand. */
  private handMaterials: MeshStandardMaterial[] = [];

  private readonly tableY: number;
  private readonly cardRowZ: number;
  private readonly costCard: Card;
  private readonly avatarSeat: AvatarSeat;
  private handCards: Card[] = [];
  private _cards: Card[];
  /** Arsenal figures tagged as clickable build triggers (`SceneObjectKind.Arsenal`). */
  private readonly arsenalFigures: Object3D[] = [];

  private resourceCounts: Record<ResourceKind, number> = this.emptyResourceCounts();
  private devCount = 0;

  /** Arsenal figure currently lifted into the air for build mode, if any. */
  private activatedFigure: Object3D | null = null;
  private readonly activatedBasePos = new Vector3();
  private readonly activatedBaseRot = new Euler();
  private readonly activatedBaseScale = new Vector3();
  /** Target lift state (1 lifted, 0 resting) the animation eases towards. */
  private activatedTarget = 0;
  /** Eased lift progress, 0..1. */
  private activatedT = 0;
  /** Time accumulator driving the bob + sway. */
  private activatedSwayT = 0;

  /** Arsenal figure currently flying onto the board, if any. */
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

  constructor(options: PlayerAreaOptions) {
    this.info = {
      seat: options.seat,
      color: options.color,
      name: playerColorLabel(options.color),
    };

    // Seat 0 sits at world +Z, then seats go clockwise around the table.
    this.group.rotation.y = options.seat * (Math.PI / 2);

    this.figureMats = createFigureMaterials(options.color);

    this.tableY = options.tableTopY;
    const innerZ = options.innerEdgeZ;
    const outerZ = options.outerEdgeZ;
    this.cardRowZ = outerZ - 1.1; // outer row of cards
    const arsenalZ = innerZ + 0.9; // inner row of figures (centred line)

    // === ARSENAL: roads (3×5), settlements (1×5), cities (1×4) ===
    this.layoutRoads(arsenalZ - 0.35, this.tableY);
    this.layoutSettlements(arsenalZ + 0.1, this.tableY);
    this.layoutCities(arsenalZ + 0.1, this.tableY);

    // === COST CARD (face-up, left side of outer row) ===
    const costThickness = 0.04;
    const cost = createCostCard({ width: 1.95, thickness: costThickness, depth: 1.25 });
    this.ownedMaterials.push(...cost.materials);
    cost.card.setGroupKey(`cost-${options.seat}`);
    const costPos = new Vector3(-6.2, this.tableY + costThickness / 2 + 0.005, this.cardRowZ);
    // baseQuat = 180° around X flips the card's -Y face up so the cost listing
    // is visible on the table; small Y jitter for hand-placed feel.
    const costQuat = new Quaternion()
      .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.04));
    cost.card.setBasePose(costPos, costQuat);
    this.group.add(cost.card.mesh);
    this.costCard = cost.card;

    this._cards = [this.costCard];
    this.avatarSeat = new AvatarSeat({
      tableTopY: this.tableY,
      outerEdgeZ: outerZ,
    });
    this.group.add(this.avatarSeat.group);

    // Seed the hand from the demo options; subsequent updates come from
    // lobby state via setHand().
    this.setHand(options.resourceHand, options.devHand.length);
  }

  /** Card meshes the hover system raycasts against — re-read after setHand(). */
  get cards(): readonly Card[] {
    return this._cards;
  }

  public getCostCard(): Card {
    return this.costCard;
  }

  public ownsHandCard(card: Card): boolean {
    for (let i = 0; i < this.handCards.length; i += 1) {
      if (this.handCards[i] === card) {
        return true;
      }
    }
    return false;
  }

  public setAvatar(kind: AvatarKind): void {
    this.avatarSeat.setAvatar(kind);
  }

  /**
   * Arsenal figures (roads / settlements / cities) the hover system raycasts
   * against to open build mode. Only the local player's set should be wired
   * into the engine's hoverables.
   */
  get arsenal(): readonly Object3D[] {
    return this.arsenalFigures;
  }

  /**
   * Lift an arsenal figure into the air and let it dangle while it is the
   * "activated" build piece; pass `null` to settle the current one back into
   * its slot. Switching directly between figures snaps the previous one home.
   */
  setActivatedArsenalFigure(figure: Object3D | null): void {
    if (figure === null) {
      this.activatedTarget = 0;
      return;
    }
    // A figure mid-flight is owned by the flight animation — never re-activate it.
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

  /** True while an activated arsenal figure of `kind` is available to fly in. */
  hasActivatedArsenalFigure(kind: BuildKind): boolean {
    return (
      this.activatedFigure !== null &&
      this.activatedFigure.userData[SceneUserDataKey.BuildKind] === kind
    );
  }

  /**
   * Launch the currently activated arsenal figure on a lob arc towards a
   * world-space target pose (the board build spot). On arrival the figure is
   * hidden — it has been "spent" — and `onArrive` fires so the board piece can
   * play its pop-in. The dangle slot is freed immediately so the next pick can
   * activate while this one is still in the air.
   */
  flyActivatedFigureToWorld(
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
    this.flyingFigure = figure;
    this.activatedFigure = null;
    this.activatedTarget = 0;
    this.activatedT = 0;

    this.flightStartPos.copy(figure.position);
    this.flightStartQuat.copy(figure.quaternion);
    this.flightStartScale.copy(figure.scale);

    // Convert the world-space target into this seat-rotated group's local space.
    this.group.updateWorldMatrix(true, false);
    this.flightTargetPos.copy(worldPosition);
    this.group.worldToLocal(this.flightTargetPos);
    this.group.getWorldQuaternion(this.flightScratchQuat).invert();
    this.flightTargetQuat.copy(this.flightScratchQuat).multiply(worldQuaternion);
    // The group carries no scale, so world scale maps straight to local scale.
    this.flightTargetScale.copy(worldScale);

    this.flightT = 0;
    this.flying = true;
    this.flightOnArrive = onArrive;
  }

  /**
   * Rebuild the dynamic hand from authoritative counts. Resource cards keep a
   * fixed slot per kind; any card beyond the previously held count of its kind
   * (and any dev card beyond the previous dev count) drops in with a deal
   * animation. Dev cards render as backs — the wire state only carries a count.
   */
  setHand(resources: readonly ResourceKind[], devCount: number): void {
    const nextCounts = this.emptyResourceCounts();
    for (let i = 0; i < resources.length; i += 1) {
      nextCounts[resources[i]] += 1;
    }

    this.clearHand();

    const cards: Card[] = [];
    const resourceGroupKey = `res-${this.info.seat}`;
    const devGroupKey = `dev-${this.info.seat}`;
    const handStartX = -2.4;
    let slot = 0;
    for (let k = 0; k < RESOURCE_DISPLAY_ORDER.length; k += 1) {
      const kind = RESOURCE_DISPLAY_ORDER[k];
      const have = nextCounts[kind];
      const had = this.resourceCounts[kind];
      for (let j = 0; j < have; j += 1) {
        const card = this.buildResourceCard(kind);
        card.setGroupKey(resourceGroupKey);
        const x = handStartX + slot * (CARD_SHORT + HAND_GAP);
        this.placeCard(card, x, this.cardRowZ, this.tableY);
        if (j >= had) {
          this.applyDealInPose(card);
        }
        this.group.add(card.mesh);
        cards.push(card);
        slot += 1;
      }
    }

    const devStartX = handStartX + slot * (CARD_SHORT + HAND_GAP) + 0.4;
    for (let i = 0; i < devCount; i += 1) {
      const card = this.buildDevCard();
      card.setGroupKey(devGroupKey);
      const x = devStartX + i * (CARD_SHORT + HAND_GAP);
      this.placeCard(card, x, this.cardRowZ, this.tableY);
      if (i >= this.devCount) {
        this.applyDealInPose(card);
      }
      this.group.add(card.mesh);
      cards.push(card);
    }

    this.handCards = cards;
    this._cards = [this.costCard, ...cards];
    this.resourceCounts = nextCounts;
    this.devCount = devCount;
  }

  update(dt: number): void {
    this.costCard.update(dt);
    for (let i = 0; i < this.handCards.length; i += 1) {
      this.handCards[i].update(dt);
    }
    this.updateActivatedFigure(dt);
    this.updateFlight(dt);
  }

  private updateFlight(dt: number): void {
    const figure = this.flyingFigure;
    if (!this.flying || figure === null) return;

    this.flightT = Math.min(1, this.flightT + dt / ARSENAL_FLIGHT_DURATION);
    const t = this.flightT;
    // easeInOutQuad — gentle launch and a soft landing on the board.
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;

    figure.position.lerpVectors(this.flightStartPos, this.flightTargetPos, eased);
    // Lob along a shallow arc so it reads as a throw onto the board.
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

    // Fully settled back home — drop the reference so it stops animating.
    if (this.activatedTarget === 0 && this.activatedT < 0.002) {
      this.restoreActivatedFigure();
      this.activatedFigure = null;
      return;
    }

    const e = this.activatedT;
    // easeOutQuad so the lift settles softly instead of arriving linearly.
    const lift = 1 - (1 - e) * (1 - e);
    const swayT = this.activatedSwayT;

    const bob = Math.sin(swayT * 2.3) * ARSENAL_BOB_AMPLITUDE * e;
    figure.position.set(
      this.activatedBasePos.x,
      this.activatedBasePos.y + ARSENAL_LIFT_HEIGHT * lift + bob,
      this.activatedBasePos.z,
    );
    // Pendulum-style dangle: sway on X and Z, with a slow yaw drift.
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

  dispose(): void {
    disposeFigureMaterials(this.figureMats);
    for (const m of this.ownedMaterials) {
      m.map?.dispose();
      m.dispose();
    }
    this.disposeHandMaterials();
    this.costCard.dispose();
    this.avatarSeat.dispose();
    for (let i = 0; i < this.handCards.length; i += 1) {
      this.handCards[i].dispose();
    }
  }

  private clearHand(): void {
    for (let i = 0; i < this.handCards.length; i += 1) {
      const card = this.handCards[i];
      this.group.remove(card.mesh);
      card.dispose();
    }
    this.handCards = [];
    this.disposeHandMaterials();
  }

  private disposeHandMaterials(): void {
    for (let i = 0; i < this.handMaterials.length; i += 1) {
      const m = this.handMaterials[i];
      m.map?.dispose();
      m.dispose();
    }
    this.handMaterials = [];
  }

  /** Lift + tilt the card above its rest pose so Card.update() drops it in. */
  private applyDealInPose(card: Card): void {
    const jitter = (Math.random() - 0.5) * DEAL_LATERAL_JITTER;
    card.mesh.position.x += jitter;
    card.mesh.position.y += DEAL_DROP_HEIGHT;
    card.mesh.position.z += jitter * 0.4;
    card.mesh.quaternion.multiply(
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.6),
    );
  }

  private emptyResourceCounts(): Record<ResourceKind, number> {
    return {
      [ResourceKind.Wood]: 0,
      [ResourceKind.Brick]: 0,
      [ResourceKind.Grain]: 0,
      [ResourceKind.Wool]: 0,
      [ResourceKind.Ore]: 0,
    };
  }

  private tagArsenalFigure(figure: Object3D, buildKind: BuildKind): void {
    figure.userData[SceneUserDataKey.Kind] = SceneObjectKind.Arsenal;
    figure.userData[SceneUserDataKey.BuildKind] = buildKind;
    this.arsenalFigures.push(figure);
  }

  private layoutRoads(centreZ: number, tableY: number): void {
    const startX = -7.0;
    const colStep = 0.7;
    const rowStep = 0.3;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const road = makeRoad(this.figureMats);
        road.position.set(startX + col * colStep, tableY + 0.005, centreZ + (row - 1) * rowStep);
        road.rotation.y = (row * 5 + col) * 0.13 - 0.3;
        this.tagArsenalFigure(road, BuildKind.Road);
        this.group.add(road);
      }
    }
  }

  private layoutSettlements(centreZ: number, tableY: number): void {
    const startX = -2.5;
    const step = 0.55;
    for (let i = 0; i < 5; i++) {
      const s = makeSettlement(this.figureMats);
      s.position.set(startX + i * step, tableY + 0.005, centreZ - 0.1);
      s.rotation.y = i * 0.21 - 0.4;
      this.tagArsenalFigure(s, BuildKind.Settlement);
      this.group.add(s);
    }
  }

  private layoutCities(centreZ: number, tableY: number): void {
    const startX = 0.6;
    const step = 0.72;
    for (let i = 0; i < 4; i++) {
      const c = makeCity(this.figureMats);
      c.position.set(startX + i * step, tableY + 0.005, centreZ - 0.05);
      c.rotation.y = i * 0.18 - 0.27;
      this.tagArsenalFigure(c, BuildKind.City);
      this.group.add(c);
    }
  }

  private buildResourceCard(kind: ResourceKind): Card {
    const faceTex = makeResourceFaceTexture(kind);
    const backTex = makeResourceBackTexture();
    const faceMat = new MeshStandardMaterial({ map: faceTex, flatShading: true, roughness: 0.85 });
    const backMat = new MeshStandardMaterial({ map: backTex, flatShading: true, roughness: 0.85 });
    const edgeMat = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });
    this.handMaterials.push(faceMat, backMat, edgeMat);
    return new Card({
      width: CARD_LONG,
      height: CARD_SHORT,
      thickness: CARD_THICKNESS,
      backMaterial: backMat,
      faceMaterial: faceMat,
      edgeMaterial: edgeMat,
      hoverInfo: {
        group: CardHoverGroup.Resource,
        resourceKind: kind,
      },
    });
  }

  private buildDevCard(): Card {
    // Lobby state only carries a dev-card count, so every dev card renders as
    // a back — its specific kind is hidden from all viewers.
    const backTex = makeDevBackTexture();
    const faceTex = makeDevBackTexture();
    const faceMat = new MeshStandardMaterial({ map: faceTex, flatShading: true, roughness: 0.85 });
    const backMat = new MeshStandardMaterial({ map: backTex, flatShading: true, roughness: 0.85 });
    const edgeMat = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });
    this.handMaterials.push(faceMat, backMat, edgeMat);
    return new Card({
      width: CARD_LONG,
      height: CARD_SHORT,
      thickness: CARD_THICKNESS,
      backMaterial: backMat,
      faceMaterial: faceMat,
      edgeMaterial: edgeMat,
      hoverInfo: {
        group: CardHoverGroup.Development,
        devKind: DevKind.Knight,
      },
    });
  }

  private placeCard(card: Card, x: number, z: number, tableY: number): void {
    const pos = new Vector3(x, tableY + CARD_THICKNESS / 2 + 0.005, z);
    // Tiny yaw jitter so hand cards don't look like a printed sheet.
    const yaw = (Math.sin(x * 7.13) * 0.5 + 0.5 - 0.5) * 0.06;
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    card.setBasePose(pos, q);
  }
}
