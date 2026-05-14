import { Group, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { BuildKind, SceneObjectKind, SceneUserDataKey } from '@catan/api-interfaces';
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
  private handCards: Card[] = [];
  private _cards: Card[];
  /** Arsenal figures tagged as clickable build triggers (`SceneObjectKind.Arsenal`). */
  private readonly arsenalFigures: Object3D[] = [];

  private resourceCounts: Record<ResourceKind, number> = this.emptyResourceCounts();
  private devCount = 0;

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

    // Seed the hand from the demo options; subsequent updates come from
    // lobby state via setHand().
    this.setHand(options.resourceHand, options.devHand.length);
  }

  /** Card meshes the hover system raycasts against — re-read after setHand(). */
  get cards(): readonly Card[] {
    return this._cards;
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
  }

  dispose(): void {
    disposeFigureMaterials(this.figureMats);
    for (const m of this.ownedMaterials) {
      m.map?.dispose();
      m.dispose();
    }
    this.disposeHandMaterials();
    this.costCard.dispose();
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
