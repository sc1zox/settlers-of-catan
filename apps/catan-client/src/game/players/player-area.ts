import { Group, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { BonusAwardKind, BuildKind } from '@catan/api-interfaces';
import { DevKind, ResourceKind } from '../cards/textures';
import { Card } from '../cards/card';
import { createBonusCard } from '../cards/bonus-card';
import { createCostCard } from '../cards/cost-card';
import { PlayerColor, playerColorLabel } from './colors';
import { ArsenalPlacedPieces, PlayerAreaArsenal } from './player-area-arsenal';
import { PlayerAreaAvatar } from './player-area-avatar';
import { PlayerAreaHand } from './player-area-hand';
import { PlayerAreaSelfPad } from './player-area-self-pad';

export interface PlayerAreaInfo {
  readonly seat: number;
  readonly color: PlayerColor;
  readonly name: string;
}

export interface PlayerAreaOptions {
  readonly color: PlayerColor;
  readonly seat: 0 | 1 | 2 | 3;
  readonly tableTopY: number;
  readonly innerEdgeZ: number;
  readonly outerEdgeZ: number;
  readonly resourceHand: readonly ResourceKind[];
  readonly devHand: readonly DevKind[];
}

export class PlayerArea {
  readonly group: Group = new Group();
  readonly info: PlayerAreaInfo;

  private readonly tableY: number;
  private readonly cardRowZ: number;
  private readonly costCard: Card;
  private readonly arsenalKit: PlayerAreaArsenal;
  private readonly hand: PlayerAreaHand;
  private readonly avatar: PlayerAreaAvatar;
  private readonly selfPad: PlayerAreaSelfPad;

  private readonly ownedMaterials: MeshStandardMaterial[] = [];
  /** Materials backing currently-displayed bonus cards — disposed on remove. */
  private readonly bonusMaterials = new Map<BonusAwardKind, MeshStandardMaterial[]>();
  private readonly bonusCards = new Map<BonusAwardKind, Card>();
  private _cards: Card[];
  private presenceDimmed = false;

  public constructor(options: PlayerAreaOptions) {
    this.info = {
      seat: options.seat,
      color: options.color,
      name: playerColorLabel(options.color),
    };

    this.group.rotation.y = options.seat * (Math.PI / 2);

    this.selfPad = new PlayerAreaSelfPad(options.color, options.tableTopY, options.innerEdgeZ);
    this.group.add(this.selfPad.group);

    this.tableY = options.tableTopY;
    const innerZ = options.innerEdgeZ;
    const outerZ = options.outerEdgeZ;
    this.cardRowZ = outerZ - 1.1;

    this.arsenalKit = new PlayerAreaArsenal({
      group: this.group,
      color: options.color,
      tableTopY: options.tableTopY,
      innerEdgeZ: innerZ,
    });

    const costThickness = 0.04;
    const cost = createCostCard({ width: 1.95, thickness: costThickness, depth: 1.25 });
    this.ownedMaterials.push(...cost.materials);
    cost.card.setGroupKey(`cost-${options.seat}`);
    const costPos = new Vector3(-6.2, this.tableY + costThickness / 2 + 0.005, this.cardRowZ);
    const costQuat = new Quaternion()
      .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.04));
    cost.card.setBasePose(costPos, costQuat);
    this.group.add(cost.card.mesh);
    this.costCard = cost.card;

    this.avatar = new PlayerAreaAvatar(
      this.group,
      this.tableY,
      outerZ,
      options.color,
      this.info.name,
    );

    this.hand = new PlayerAreaHand(this.group, options.seat, this.tableY, this.cardRowZ);
    this._cards = [this.costCard];

    this.setHand(options.resourceHand, options.devHand.length);
  }

  public get cards(): readonly Card[] {
    return this._cards;
  }

  public setFeltVisible(visible: boolean): void {
    this.selfPad.setVisible(visible);
  }

  public setSelfSeatHighlight(active: boolean): void {
    this.selfPad.setActive(active);
  }

  public setPresenceDimmed(dimmed: boolean): void {
    if (this.presenceDimmed === dimmed) {
      return;
    }
    this.presenceDimmed = dimmed;
    this.avatar.setPresenceDimmed(dimmed);
    this.selfPad.setPresenceDimmed(dimmed);
    this.hand.setPresenceDimmed(dimmed);
    this.costCard.setPresenceDimmed(dimmed);
    for (const bonus of this.bonusCards.values()) {
      bonus.setPresenceDimmed(dimmed);
    }
    this.arsenalKit.setPresenceDimmed(dimmed);
  }

  public getCostCard(): Card {
    return this.costCard;
  }

  public ownsHandCard(card: Card): boolean {
    return this.hand.ownsHandCard(card);
  }

  public setHeadVideo(video: HTMLVideoElement | null, showNoCameraPlaceholder = false): void {
    this.avatar.setHeadVideo(video, showNoCameraPlaceholder);
  }

  public setHeadVideoDisplayGamma(gamma: number): void {
    this.avatar.setHeadVideoDisplayGamma(gamma);
  }

  public setDisplayName(name: string): void {
    this.avatar.setDisplayName(name);
  }

  public updateAvatarVideo(): void {
    this.avatar.updateVideoTick();
  }

  public get arsenal(): readonly Object3D[] {
    return this.arsenalKit.arsenal;
  }

  public setActivatedArsenalFigure(figure: Object3D | null): void {
    this.arsenalKit.setActivatedArsenalFigure(figure);
  }

  public hasActivatedArsenalFigure(kind: BuildKind): boolean {
    return this.arsenalKit.hasActivatedArsenalFigure(kind);
  }

  public hasAvailableArsenalFigure(kind: BuildKind): boolean {
    return this.arsenalKit.hasAvailableArsenalFigure(kind);
  }

  public setPlacedArsenalPieces(placed: ArsenalPlacedPieces): void {
    this.arsenalKit.setPlacedPieces(placed);
  }

  public flyActivatedFigureToWorld(
    worldPosition: Vector3,
    worldQuaternion: Quaternion,
    worldScale: Vector3,
    onArrive: () => void,
  ): void {
    this.arsenalKit.flyActivatedFigureToWorld(worldPosition, worldQuaternion, worldScale, onArrive);
  }

  public flyArsenalFigureOfKindToWorld(
    kind: BuildKind,
    worldPosition: Vector3,
    worldQuaternion: Quaternion,
    worldScale: Vector3,
    onArrive: () => void,
  ): boolean {
    return this.arsenalKit.flyArsenalFigureOfKindToWorld(
      kind,
      worldPosition,
      worldQuaternion,
      worldScale,
      onArrive,
    );
  }

  public setHand(
    resources: readonly ResourceKind[],
    devCount: number,
    devKinds: readonly DevKind[] | null = null,
    hiddenResourceCount: number | null = null,
  ): void {
    this.hand.setHand(resources, devCount, devKinds, hiddenResourceCount);
    this.refreshCardList();
  }

  /**
   * Add or remove an award card (Längste Handelsstraße / Größte Rittermacht)
   * from this seat's outer card row. The mesh persists across re-syncs so the
   * fly-in animation can drive it directly via {@link getBonusCard}.
   */
  public setBonusCard(kind: BonusAwardKind, owned: boolean): Card | null {
    if (owned) {
      const existing = this.bonusCards.get(kind);
      if (existing) {
        return existing;
      }
      const bonusThickness = 0.04;
      const bonus = createBonusCard({
        kind,
        width: 1.0,
        depth: 0.7,
        thickness: bonusThickness,
      });
      bonus.card.setGroupKey(`bonus-${this.info.seat}-${kind}`);
      const restPos = this.bonusRestPosition(kind, bonusThickness);
      const restQuat = this.bonusRestQuaternion(kind);
      bonus.card.setBasePose(restPos, restQuat);
      this.group.add(bonus.card.mesh);
      this.bonusCards.set(kind, bonus.card);
      this.bonusMaterials.set(kind, [...bonus.materials]);
      bonus.card.setPresenceDimmed(this.presenceDimmed);
      this.refreshCardList();
      return bonus.card;
    }
    const existing = this.bonusCards.get(kind);
    if (!existing) {
      return null;
    }
    existing.setMode('rest');
    this.group.remove(existing.mesh);
    existing.dispose();
    this.bonusCards.delete(kind);
    const mats = this.bonusMaterials.get(kind);
    if (mats) {
      for (let i = 0; i < mats.length; i += 1) {
        mats[i].map?.dispose();
        mats[i].dispose();
      }
      this.bonusMaterials.delete(kind);
    }
    this.refreshCardList();
    return null;
  }

  public getBonusCard(kind: BonusAwardKind): Card | undefined {
    return this.bonusCards.get(kind);
  }

  /**
   * World-space position of this seat's avatar head — the anchor point the
   * fly-in animation uses for the "in front of the recipient's screen" pose.
   */
  public getAvatarHeadWorldPosition(out: Vector3): Vector3 {
    return this.avatar.getHeadWorldPosition(out);
  }

  /**
   * World-space anchor at the middle of this seat's hand row — used as the
   * spawn / arrival point for inter-seat card flights (e.g. trade-swap).
   */
  public getHandRowWorldPosition(out: Vector3): Vector3 {
    out.set(-3.8, this.tableY + 0.05, this.cardRowZ);
    this.group.updateWorldMatrix(true, false);
    return out.applyMatrix4(this.group.matrixWorld);
  }

  /**
   * Layout slots between the cost card (X ≈ -5.2) and the hand (X ≈ -2.7) so
   * both award cards fit without overlapping either neighbour, and rotate with
   * the seat group.
   */
  private bonusRestPosition(kind: BonusAwardKind, thickness: number): Vector3 {
    const slotX = kind === BonusAwardKind.LongestRoad ? -4.6 : -3.45;
    return new Vector3(slotX, this.tableY + thickness / 2 + 0.005, this.cardRowZ);
  }

  private bonusRestQuaternion(kind: BonusAwardKind): Quaternion {
    // Flip the card face-up (face material is on the -Y face) and add a tiny
    // seat-specific yaw jitter so the two awards don't look machine-stamped.
    const yaw = kind === BonusAwardKind.LongestRoad ? 0.05 : -0.06;
    return new Quaternion()
      .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw));
  }

  private refreshCardList(): void {
    this._cards = [this.costCard, ...this.bonusCards.values(), ...this.hand.cards];
  }

  public update(dt: number): void {
    this.costCard.update(dt);
    for (const bonus of this.bonusCards.values()) {
      bonus.update(dt);
    }
    this.hand.update(dt);
    this.avatar.update(dt);
    this.arsenalKit.update(dt);
    this.selfPad.update(dt);
  }

  public dispose(): void {
    this.selfPad.dispose();
    this.arsenalKit.dispose();
    for (const m of this.ownedMaterials) {
      m.map?.dispose();
      m.dispose();
    }
    for (const card of this.bonusCards.values()) {
      card.dispose();
    }
    for (const mats of this.bonusMaterials.values()) {
      for (let i = 0; i < mats.length; i += 1) {
        mats[i].map?.dispose();
        mats[i].dispose();
      }
    }
    this.bonusCards.clear();
    this.bonusMaterials.clear();
    this.hand.dispose();
    this.costCard.dispose();
    this.avatar.dispose();
  }
}
