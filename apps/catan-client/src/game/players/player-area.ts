import { Group, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import { BuildKind } from '@catan/api-interfaces';
import { DevKind, ResourceKind } from '../cards/textures';
import { Card } from '../cards/card';
import { createCostCard } from '../cards/cost-card';
import { PlayerColor, playerColorLabel } from './colors';
import { PlayerAreaArsenal } from './player-area-arsenal';
import { PlayerAreaAvatar } from './player-area-avatar';
import { PlayerAreaHand } from './player-area-hand';

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

  private readonly ownedMaterials: MeshStandardMaterial[] = [];
  private _cards: Card[];

  public constructor(options: PlayerAreaOptions) {
    this.info = {
      seat: options.seat,
      color: options.color,
      name: playerColorLabel(options.color),
    };

    this.group.rotation.y = options.seat * (Math.PI / 2);

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

    this.avatar = new PlayerAreaAvatar(this.group, this.tableY, outerZ, options.color, this.info.name);

    this.hand = new PlayerAreaHand(this.group, options.seat, this.tableY, this.cardRowZ);
    this._cards = [this.costCard];

    this.setHand(options.resourceHand, options.devHand.length);
  }

  public get cards(): readonly Card[] {
    return this._cards;
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

  public flyActivatedFigureToWorld(
    worldPosition: Vector3,
    worldQuaternion: Quaternion,
    worldScale: Vector3,
    onArrive: () => void,
  ): void {
    this.arsenalKit.flyActivatedFigureToWorld(worldPosition, worldQuaternion, worldScale, onArrive);
  }

  public setHand(resources: readonly ResourceKind[], devCount: number): void {
    this.hand.setHand(resources, devCount);
    this._cards = [this.costCard, ...this.hand.cards];
  }

  public update(dt: number): void {
    this.costCard.update(dt);
    this.hand.update(dt);
    this.avatar.update(dt);
    this.arsenalKit.update(dt);
  }

  public dispose(): void {
    this.arsenalKit.dispose();
    for (const m of this.ownedMaterials) {
      m.map?.dispose();
      m.dispose();
    }
    this.hand.dispose();
    this.costCard.dispose();
    this.avatar.dispose();
  }
}
