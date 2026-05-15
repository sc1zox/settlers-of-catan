import { Camera, Object3D, Raycaster, Vector2 } from 'three';
import {
  ArsenalClickHandler,
  BuildSpotClickHandler,
  BuildSpotHoverHandler,
  SceneObjectKind,
  SceneUserDataKey,
  TileClickHandler,
} from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { Card } from '../cards/card';
import { devKindLabel, resourceKindLabel } from '../cards/textures';
import { gt } from '../i18n-bridge';
import { Die } from '../dice/die';
import { CardHoverGroup } from '../shared/card-hover';
import { Harbor } from '../world/harbors';
import { Tile } from '../tiles/tile';

export interface CardHoverTooltip {
  readonly title: string;
  readonly detail: string;
}

export type HoverTarget =
  | { kind: SceneObjectKind.Harbor; harbor: Harbor }
  | { kind: SceneObjectKind.Chip; tile: Tile }
  | { kind: SceneObjectKind.Card; card: Card; tooltip: CardHoverTooltip };

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
 * over. Targets are classified via {@link SceneUserDataKey.Kind} carrying a
 * {@link SceneObjectKind}:
 *  - Harbor / Chip      → hover tooltip
 *  - Card / Die         → click (focus / roll)
 *  - BuildSpot / Arsenal→ build-mode interaction
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
  private buildSpotHoverHandler: BuildSpotHoverHandler | null = null;
  private buildSpotClickHandler: BuildSpotClickHandler | null = null;
  private arsenalClickHandler: ArsenalClickHandler | null = null;
  private tileClickHandler: TileClickHandler | null = null;
  private pointerPickEnabled = true;
  private exploreReadOnly = false;
  private lastState: HoverState | null = null;
  private currentTile: Tile | null = null;
  private currentCard: Card | null = null;
  private currentBuildSpot: Object3D | null = null;
  private hoverables: readonly Object3D[];

  constructor(
    private readonly domElement: HTMLElement,
    private readonly camera: Camera,
    hoverables: readonly Object3D[],
  ) {
    this.hoverables = hoverables;
    domElement.addEventListener('pointermove', this.onPointerMove);
    domElement.addEventListener('pointerleave', this.onPointerLeave);
    domElement.addEventListener('click', this.onClick);
  }

  /** Replace the raycast set after the board or player hands are rebuilt. */
  setHoverables(hoverables: readonly Object3D[]): void {
    this.hoverables = hoverables;
    this.setHoveredTile(null);
    this.setHoveredCard(null);
    this.setHoveredBuildSpot(null);
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

  setBuildSpotHoverHandler(handler: BuildSpotHoverHandler | null): void {
    this.buildSpotHoverHandler = handler;
  }

  setBuildSpotClickHandler(handler: BuildSpotClickHandler | null): void {
    this.buildSpotClickHandler = handler;
  }

  setArsenalClickHandler(handler: ArsenalClickHandler | null): void {
    this.arsenalClickHandler = handler;
  }

  /** Set during robber placement so a chip click reports the targeted tile. */
  setTileClickHandler(handler: TileClickHandler | null): void {
    this.tileClickHandler = handler;
  }

  public setPointerPickEnabled(enabled: boolean): void {
    this.pointerPickEnabled = enabled;
  }

  public setExploreReadOnly(enabled: boolean): void {
    this.exploreReadOnly = enabled;
  }

  update(): void {
    if (!this.pointerInside) {
      this.emit(null);
      this.setHoveredTile(null);
      this.setHoveredCard(null);
      this.setHoveredBuildSpot(null);
      return;
    }
    if (!this.pointerPickEnabled) {
      this.emit(null);
      this.setHoveredTile(null);
      this.setHoveredCard(null);
      this.setHoveredBuildSpot(null);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hoverables as Object3D[], true);
    for (let i = 0; i < hits.length; i++) {
      const obj = walkToKind(hits[i].object);
      if (!obj) continue;
      if (!isVisibleInHierarchy(obj)) continue;
      const kind = obj.userData[SceneUserDataKey.Kind] as SceneObjectKind | undefined;
      if (kind === SceneObjectKind.BuildSpot) {
        this.setHoveredBuildSpot(obj);
        this.setHoveredTile(null);
        this.setHoveredCard(null);
        this.emit(null);
        return;
      }
      if (kind === SceneObjectKind.Arsenal) {
        this.setHoveredBuildSpot(null);
        this.setHoveredTile(null);
        this.setHoveredCard(null);
        this.emit(null);
        return;
      }
      if (kind === SceneObjectKind.Harbor) {
        const harbor = obj.userData[SceneUserDataKey.Harbor] as Harbor;
        this.setHoveredBuildSpot(null);
        this.setHoveredTile(null);
        this.setHoveredCard(null);
        this.emit({
          target: { kind: SceneObjectKind.Harbor, harbor },
          screenX: this.screenX,
          screenY: this.screenY,
        });
        return;
      }
      if (kind === SceneObjectKind.Chip) {
        const tile = obj.userData[SceneUserDataKey.Tile] as Tile;
        this.setHoveredBuildSpot(null);
        this.setHoveredTile(tile);
        this.setHoveredCard(null);
        this.emit({
          target: { kind: SceneObjectKind.Chip, tile },
          screenX: this.screenX,
          screenY: this.screenY,
        });
        return;
      }
      if (kind === SceneObjectKind.Card || kind === SceneObjectKind.Die) {
        const topObj = this.pickTopOpaqueHit(hits, i, obj);
        const topKind = topObj.userData[SceneUserDataKey.Kind] as SceneObjectKind | undefined;
        this.setHoveredBuildSpot(null);
        this.setHoveredTile(null);
        if (topKind === SceneObjectKind.Die) {
          this.setHoveredCard(null);
          this.emit(null);
          return;
        }
        const card = topObj.userData[SceneUserDataKey.Card] as Card;
        this.setHoveredCard(card);
        const tooltip = this.buildCardTooltip(card);
        if (!tooltip) {
          this.emit(null);
          return;
        }
        this.emit({
          target: { kind: SceneObjectKind.Card, card, tooltip },
          screenX: this.screenX,
          screenY: this.screenY,
        });
        return;
      }
    }
    this.setHoveredTile(null);
    this.setHoveredCard(null);
    this.setHoveredBuildSpot(null);
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

  private setHoveredBuildSpot(figure: Object3D | null): void {
    if (this.currentBuildSpot === figure) return;
    this.currentBuildSpot = figure;
    this.buildSpotHoverHandler?.(figure);
  }

  private emit(state: HoverState | null): void {
    // Only emit when the target or its position meaningfully changed.
    if (!state && !this.lastState) return;
    if (
      state &&
      this.lastState &&
      this.lastState.target.kind === state.target.kind &&
      (state.target.kind === SceneObjectKind.Harbor
        ? this.lastState.target.kind === SceneObjectKind.Harbor &&
          this.lastState.target.harbor === state.target.harbor
        : state.target.kind === SceneObjectKind.Chip
          ? this.lastState.target.kind === SceneObjectKind.Chip &&
            this.lastState.target.tile === state.target.tile
          : this.lastState.target.kind === SceneObjectKind.Card &&
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
    if (!this.pointerPickEnabled) {
      return;
    }
    if (this.exploreReadOnly) {
      return;
    }
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
      if (!isVisibleInHierarchy(obj)) continue;
      const kind = obj.userData[SceneUserDataKey.Kind] as SceneObjectKind | undefined;
      if (kind === SceneObjectKind.BuildSpot) {
        this.buildSpotClickHandler?.(obj, ev.clientX, ev.clientY);
        return;
      }
      if (kind === SceneObjectKind.Arsenal) {
        this.arsenalClickHandler?.(obj);
        return;
      }
      if (kind === SceneObjectKind.Chip && this.tileClickHandler) {
        this.tileClickHandler(obj, ev.clientX, ev.clientY);
        return;
      }
      if (kind === SceneObjectKind.Card) {
        const card = obj.userData[SceneUserDataKey.Card] as Card;
        this.cardClickHandler?.(card);
        return;
      }
      if (kind === SceneObjectKind.Die) {
        const die = obj.userData[SceneUserDataKey.Die] as Die;
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
        title: gt(marker('hover.resourceCardTitle')),
        detail: resourceKindLabel(info.resourceKind),
      };
    }
    if (info.group === CardHoverGroup.Development && info.devKind) {
      return {
        title: gt(marker('hover.devCardTitle')),
        detail: devKindLabel(info.devKind),
      };
    }
    return null;
  }

  private pickTopOpaqueHit(
    hits: readonly { object: Object3D }[],
    startIndex: number,
    initial: Object3D,
  ): Object3D {
    let topObj = initial;
    for (let i = startIndex + 1; i < hits.length; i++) {
      const candidate = walkToKind(hits[i].object);
      if (!candidate) continue;
      if (!isVisibleInHierarchy(candidate)) continue;
      const candidateKind = candidate.userData[SceneUserDataKey.Kind] as SceneObjectKind | undefined;
      if (candidateKind !== SceneObjectKind.Card && candidateKind !== SceneObjectKind.Die) continue;
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
    if (current.userData && current.userData[SceneUserDataKey.Kind]) return current;
    current = current.parent;
  }
  return null;
}

function isVisibleInHierarchy(obj: Object3D): boolean {
  let current: Object3D | null = obj;
  while (current) {
    if (!current.visible) {
      return false;
    }
    current = current.parent;
  }
  return true;
}
