import { Group, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { BonusAwardKind, BuildKind } from '@catan/api-interfaces';
import { DevKind, ResourceKind } from '../cards/textures';
import { Card } from '../cards/card';
import { createCostCard } from '../cards/cost-card';
import { PlayerColor, playerColorLabel } from './colors';
import { ArsenalPlacedPieces, PlayerAreaArsenal } from './player-area-arsenal';
import { PlayerAreaAvatar } from './player-area-avatar';
import { PlayerAreaBonusCards } from './player-area-bonus-cards';
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
  private readonly bonusCardsKit: PlayerAreaBonusCards;

  private readonly ownedMaterials: MeshStandardMaterial[] = [];
  private _cards: Card[];
  private presenceDimmed = false;

  public constructor(options: PlayerAreaOptions) {
    this.info = {
      seat: options.seat,
      color: options.color,
      name: playerColorLabel(options.color),
    };

    this.group.rotation.y = -options.seat * (Math.PI / 2);

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
    this.bonusCardsKit = new PlayerAreaBonusCards({
      group: this.group,
      seat: options.seat,
      tableTopY: this.tableY,
      cardRowZ: this.cardRowZ,
    });
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
    this.bonusCardsKit.setPresenceDimmed(dimmed);
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
    const card = this.bonusCardsKit.set(kind, owned);
    this.refreshCardList();
    return card;
  }

  public getBonusCard(kind: BonusAwardKind): Card | undefined {
    return this.bonusCardsKit.getCard(kind);
  }

  public getBonusCards(): readonly Card[] {
    return this.bonusCardsKit.listCards();
  }

  public ownsBonusCard(card: Card): boolean {
    return this.bonusCardsKit.ownsCard(card);
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

  private refreshCardList(): void {
    this._cards = [this.costCard, ...this.bonusCardsKit.listCards(), ...this.hand.cards];
  }

  public update(dt: number): void {
    this.costCard.update(dt);
    this.bonusCardsKit.update(dt);
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
    this.bonusCardsKit.dispose();
    this.hand.dispose();
    this.costCard.dispose();
    this.avatar.dispose();
  }
}
