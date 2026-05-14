import { Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { Card } from '../cards/card';
import { createCostCard } from '../cards/cost-card';
import {
  DevKind,
  ResourceKind,
  makeDevBackTexture,
  makeDevFaceTexture,
  makeResourceBackTexture,
  makeResourceFaceTexture,
} from '../cards/textures';
import { CardHoverGroup } from '../shared/card-hover';
import { PlayerColor, PLAYER_NAME_DE } from './colors';
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

export class PlayerArea {
  readonly group: Group = new Group();
  readonly info: PlayerAreaInfo;
  readonly cards: readonly Card[];

  private readonly figureMats: PlayerFigureMaterials;
  /** All materials owned by this area — disposed in dispose(). */
  private readonly ownedMaterials: MeshStandardMaterial[] = [];

  constructor(options: PlayerAreaOptions) {
    this.info = {
      seat: options.seat,
      color: options.color,
      name: PLAYER_NAME_DE[options.color],
    };

    // Seat 0 sits at world +Z, then seats go clockwise around the table.
    this.group.rotation.y = options.seat * (Math.PI / 2);

    this.figureMats = createFigureMaterials(options.color);

    const tableY = options.tableTopY;
    const innerZ = options.innerEdgeZ;
    const outerZ = options.outerEdgeZ;
    const cardRowZ = outerZ - 1.1; // outer row of cards
    const arsenalZ = innerZ + 0.9; // inner row of figures (centred line)

    // === ARSENAL: roads (3×5), settlements (1×5), cities (1×4) ===
    this.layoutRoads(arsenalZ - 0.35, tableY);
    this.layoutSettlements(arsenalZ + 0.1, tableY);
    this.layoutCities(arsenalZ + 0.1, tableY);

    // === COST CARD (face-up, left side of outer row) ===
    const costThickness = 0.04;
    const cost = createCostCard({ width: 1.95, thickness: costThickness, depth: 1.25 });
    this.ownedMaterials.push(...cost.materials);
    cost.card.setGroupKey(`cost-${options.seat}`);
    const costPos = new Vector3(-6.2, tableY + costThickness / 2 + 0.005, cardRowZ);
    // baseQuat = 180° around X flips the card's -Y face up so the cost listing
    // is visible on the table; small Y jitter for hand-placed feel.
    const costQuat = new Quaternion()
      .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.04));
    cost.card.setBasePose(costPos, costQuat);
    this.group.add(cost.card.mesh);

    // === HAND: cost reference + resource cards + dev cards ===
    const cards: Card[] = [cost.card];
    const resourceGroupKey = `res-${options.seat}`;
    const devGroupKey = `dev-${options.seat}`;
    const handStartX = -2.4;
    for (let i = 0; i < options.resourceHand.length; i++) {
      const kind = options.resourceHand[i];
      const card = this.buildResourceCard(kind);
      card.setGroupKey(resourceGroupKey);
      const x = handStartX + i * (CARD_SHORT + HAND_GAP);
      this.placeCard(card, x, cardRowZ, tableY);
      this.group.add(card.mesh);
      cards.push(card);
    }
    const devStartX = handStartX + options.resourceHand.length * (CARD_SHORT + HAND_GAP) + 0.4;
    for (let i = 0; i < options.devHand.length; i++) {
      const kind = options.devHand[i];
      const card = this.buildDevCard(kind);
      card.setGroupKey(devGroupKey);
      const x = devStartX + i * (CARD_SHORT + HAND_GAP);
      this.placeCard(card, x, cardRowZ, tableY);
      this.group.add(card.mesh);
      cards.push(card);
    }
    this.cards = cards;
  }

  update(dt: number): void {
    for (const card of this.cards) card.update(dt);
  }

  dispose(): void {
    disposeFigureMaterials(this.figureMats);
    for (const m of this.ownedMaterials) {
      m.map?.dispose();
      m.dispose();
    }
    for (const card of this.cards) card.dispose();
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
      this.group.add(c);
    }
  }

  private buildResourceCard(kind: ResourceKind): Card {
    const faceTex = makeResourceFaceTexture(kind);
    const backTex = makeResourceBackTexture();
    const faceMat = new MeshStandardMaterial({ map: faceTex, flatShading: true, roughness: 0.85 });
    const backMat = new MeshStandardMaterial({ map: backTex, flatShading: true, roughness: 0.85 });
    const edgeMat = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });
    this.ownedMaterials.push(faceMat, backMat, edgeMat);
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

  private buildDevCard(kind: DevKind): Card {
    const faceTex = makeDevFaceTexture(kind);
    const backTex = makeDevBackTexture();
    const faceMat = new MeshStandardMaterial({ map: faceTex, flatShading: true, roughness: 0.85 });
    const backMat = new MeshStandardMaterial({ map: backTex, flatShading: true, roughness: 0.85 });
    const edgeMat = new MeshStandardMaterial({ color: 0x6b4a26, flatShading: true });
    this.ownedMaterials.push(faceMat, backMat, edgeMat);
    return new Card({
      width: CARD_LONG,
      height: CARD_SHORT,
      thickness: CARD_THICKNESS,
      backMaterial: backMat,
      faceMaterial: faceMat,
      edgeMaterial: edgeMat,
      hoverInfo: {
        group: CardHoverGroup.Development,
        devKind: kind,
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
