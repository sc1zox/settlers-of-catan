import { Group, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import {
  DevKind,
  ResourceKind,
  makeDevBackTexture,
  makeResourceBackTexture,
  makeResourceFaceTexture,
} from '../cards/textures';
import { Card } from '../cards/card';
import { CardHoverGroup } from '../shared/card-hover';
import {
  CARD_LONG,
  CARD_SHORT,
  CARD_THICKNESS,
  DEAL_DROP_HEIGHT,
  DEAL_LATERAL_JITTER,
  HAND_GAP,
  RESOURCE_DISPLAY_ORDER,
} from './player-area-constants';

export class PlayerAreaHand {
  private handCards: Card[] = [];
  private handMaterials: MeshStandardMaterial[] = [];
  private resourceCounts: Record<ResourceKind, number>;
  private devCount = 0;
  private presenceDimmed = false;

  public constructor(
    private readonly group: Group,
    private readonly seat: number,
    private readonly tableY: number,
    private readonly cardRowZ: number,
  ) {
    this.resourceCounts = this.emptyResourceCounts();
  }

  public get cards(): readonly Card[] {
    return this.handCards;
  }

  public ownsHandCard(card: Card): boolean {
    for (let i = 0; i < this.handCards.length; i += 1) {
      if (this.handCards[i] === card) {
        return true;
      }
    }
    return false;
  }

  public setHand(resources: readonly ResourceKind[], nextDevCount: number): void {
    const nextCounts = this.emptyResourceCounts();
    for (let i = 0; i < resources.length; i += 1) {
      nextCounts[resources[i]] += 1;
    }

    this.clearHand();

    const cards: Card[] = [];
    const resourceGroupKey = `res-${this.seat}`;
    const devGroupKey = `dev-${this.seat}`;
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
    for (let i = 0; i < nextDevCount; i += 1) {
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
    this.resourceCounts = nextCounts;
    this.devCount = nextDevCount;
    this.applyPresenceDimToHand();
  }

  public setPresenceDimmed(dimmed: boolean): void {
    if (this.presenceDimmed === dimmed) {
      return;
    }
    this.presenceDimmed = dimmed;
    this.applyPresenceDimToHand();
  }

  private applyPresenceDimToHand(): void {
    for (let i = 0; i < this.handCards.length; i += 1) {
      this.handCards[i].setPresenceDimmed(this.presenceDimmed);
    }
  }

  public update(dt: number): void {
    for (let i = 0; i < this.handCards.length; i += 1) {
      this.handCards[i].update(dt);
    }
  }

  public dispose(): void {
    this.clearHand();
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

  private applyDealInPose(card: Card): void {
    const jitter = (Math.random() - 0.5) * DEAL_LATERAL_JITTER;
    card.mesh.position.x += jitter;
    card.mesh.position.y += DEAL_DROP_HEIGHT;
    card.mesh.position.z += jitter * 0.4;
    card.mesh.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.6));
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
    const yaw = (Math.sin(x * 7.13) * 0.5 + 0.5 - 0.5) * 0.06;
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    card.setBasePose(pos, q);
  }
}
