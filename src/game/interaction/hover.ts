import { Camera, Object3D, Raycaster, Vector2 } from 'three';
import { Card } from '../cards/card';
import { DEV_LABEL_DE, RESOURCE_LABEL_DE } from '../cards/textures';
import { Die } from '../dice/die';
import { CardHoverGroup } from '../shared/card-hover';
import { Harbor } from '../world/harbors';
import { Tile } from '../tiles/tile';

export interface CardHoverTooltip {
  readonly title: string;
  readonly detail: string;
}

export type HoverTarget =
  | { kind: 'harbor'; harbor: Harbor }
  | { kind: 'chip'; tile: Tile }
  | { kind: 'card'; card: Card; tooltip: CardHoverTooltip };

export interface HoverState {
  readonly target: HoverTarget;
  readonly screenX: number;
  readonly screenY: number;
}

export type HoverHandler = (state: HoverState | null) => void;
export type CardClickHandler = (card: Card) => void;
export type DieClickHandler = (die: Die) => void;
export type BackgroundClickHandler = () => void;

/**
 * Tracks mouse position and raycasts each frame to detect what the cursor is
 * over. Three target families are supported via `userData['kind']`:
 *  - 'harbor' / 'chip' for hover (tooltip)
 *  - 'card' / 'die'   for click  (focus / roll)
 */
export class HoverSystem {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private pointerInside = false;
  private screenX = 0;
  private screenY = 0;
  private handler: HoverHandler | null = null;
  private cardClickHandler: CardClickHandler | null = null;
  private dieClickHandler: DieClickHandler | null = null;
  private backgroundClickHandler: BackgroundClickHandler | null = null;
  private lastState: HoverState | null = null;
  private currentTile: Tile | null = null;
  private currentCard: Card | null = null;

  constructor(
    private readonly domElement: HTMLElement,
    private readonly camera: Camera,
    private readonly hoverables: readonly Object3D[],
  ) {
    domElement.addEventListener('pointermove', this.onPointerMove);
    domElement.addEventListener('pointerleave', this.onPointerLeave);
    domElement.addEventListener('click', this.onClick);
  }

  setHandler(handler: HoverHandler | null): void {
    this.handler = handler;
  }

  setCardClickHandler(handler: CardClickHandler | null): void {
    this.cardClickHandler = handler;
  }

  setDieClickHandler(handler: DieClickHandler | null): void {
    this.dieClickHandler = handler;
  }

  setBackgroundClickHandler(handler: BackgroundClickHandler | null): void {
    this.backgroundClickHandler = handler;
  }

  update(): void {
    if (!this.pointerInside) {
      this.emit(null);
      this.setHoveredTile(null);
      this.setHoveredCard(null);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hoverables as Object3D[], true);
    for (let i = 0; i < hits.length; i++) {
      const obj = walkToKind(hits[i].object);
      if (!obj) continue;
      const kind = obj.userData['kind'];
      if (kind === 'harbor') {
        const harbor = obj.userData['harbor'] as Harbor;
        this.setHoveredTile(null);
        this.setHoveredCard(null);
        this.emit({
          target: { kind: 'harbor', harbor },
          screenX: this.screenX,
          screenY: this.screenY,
        });
        return;
      }
      if (kind === 'chip') {
        const tile = obj.userData['tile'] as Tile;
        this.setHoveredTile(tile);
        this.setHoveredCard(null);
        this.emit({
          target: { kind: 'chip', tile },
          screenX: this.screenX,
          screenY: this.screenY,
        });
        return;
      }
      if (kind === 'card' || kind === 'die') {
        const topObj = this.pickTopOpaqueHit(hits, i, obj);
        const topKind = topObj.userData['kind'];
        this.setHoveredTile(null);
        if (topKind === 'die') {
          this.setHoveredCard(null);
          this.emit(null);
          return;
        }
        const card = topObj.userData['card'] as Card;
        this.setHoveredCard(card);
        const tooltip = this.buildCardTooltip(card);
        if (!tooltip) {
          this.emit(null);
          return;
        }
        this.emit({
          target: { kind: 'card', card, tooltip },
          screenX: this.screenX,
          screenY: this.screenY,
        });
        return;
      }
    }
    this.setHoveredTile(null);
    this.setHoveredCard(null);
    this.emit(null);
  }

  dispose(): void {
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.domElement.removeEventListener('click', this.onClick);
  }

  private setHoveredTile(tile: Tile | null): void {
    if (this.currentTile && this.currentTile !== tile) {
      this.currentTile.setChipHovered(false);
    }
    if (tile) tile.setChipHovered(true);
    this.currentTile = tile;
  }

  private setHoveredCard(card: Card | null): void {
    if (this.currentCard && this.currentCard !== card) {
      this.currentCard.setHovered(false);
    }
    if (card) card.setHovered(true);
    this.currentCard = card;
  }

  private emit(state: HoverState | null): void {
    // Only emit when the target or its position meaningfully changed.
    if (!state && !this.lastState) return;
    if (
      state &&
      this.lastState &&
      this.lastState.target.kind === state.target.kind &&
      (state.target.kind === 'harbor'
        ? this.lastState.target.kind === 'harbor' &&
          this.lastState.target.harbor === state.target.harbor
        : state.target.kind === 'chip'
          ? this.lastState.target.kind === 'chip' &&
            this.lastState.target.tile === state.target.tile
          : this.lastState.target.kind === 'card' &&
            this.lastState.target.card === state.target.card) &&
      Math.abs((this.lastState.screenX ?? 0) - state.screenX) < 1 &&
      Math.abs((this.lastState.screenY ?? 0) - state.screenY) < 1
    ) {
      return;
    }
    this.lastState = state;
    this.handler?.(state);
  }

  private readonly onPointerMove = (ev: PointerEvent): void => {
    const rect = this.domElement.getBoundingClientRect();
    this.screenX = ev.clientX;
    this.screenY = ev.clientY;
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerInside = true;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
  };

  private readonly onClick = (ev: MouseEvent): void => {
    const rect = this.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hoverables as Object3D[], true);
    for (const hit of hits) {
      const obj = walkToKind(hit.object);
      if (!obj) continue;
      const kind = obj.userData['kind'];
      if (kind === 'card') {
        const card = obj.userData['card'] as Card;
        this.cardClickHandler?.(card);
        return;
      }
      if (kind === 'die') {
        const die = obj.userData['die'] as Die;
        this.dieClickHandler?.(die);
        return;
      }
    }
    this.backgroundClickHandler?.();
  };

  private buildCardTooltip(card: Card): CardHoverTooltip | null {
    const info = card.getHoverInfo();
    if (!info) return null;
    if (info.group === CardHoverGroup.Resource && info.resourceKind) {
      return {
        title: 'Rohstoffkarte',
        detail: RESOURCE_LABEL_DE[info.resourceKind],
      };
    }
    if (info.group === CardHoverGroup.Development && info.devKind) {
      return {
        title: 'Entwicklungskarte',
        detail: DEV_LABEL_DE[info.devKind],
      };
    }
    return null;
  }

  private pickTopOpaqueHit(hits: readonly { object: Object3D }[], startIndex: number, initial: Object3D): Object3D {
    let topObj = initial;
    for (let i = startIndex + 1; i < hits.length; i++) {
      const candidate = walkToKind(hits[i].object);
      if (!candidate) continue;
      const candidateKind = candidate.userData['kind'];
      if (candidateKind !== 'card' && candidateKind !== 'die') continue;
      if (candidate.renderOrder > topObj.renderOrder) {
        topObj = candidate;
      }
    }
    return topObj;
  }
}

function walkToKind(obj: Object3D): Object3D | null {
  let current: Object3D | null = obj;
  while (current) {
    if (current.userData && current.userData['kind']) return current;
    current = current.parent;
  }
  return null;
}
