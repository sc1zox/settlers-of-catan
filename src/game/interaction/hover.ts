import { Camera, Object3D, Raycaster, Vector2 } from 'three';
import { Card } from '../cards/card';
import { Harbor } from '../world/harbors';
import { Tile } from '../tiles/tile';

export type HoverTarget = { kind: 'harbor'; harbor: Harbor } | { kind: 'chip'; tile: Tile };

export interface HoverState {
  readonly target: HoverTarget;
  readonly screenX: number;
  readonly screenY: number;
}

export type HoverHandler = (state: HoverState | null) => void;

/**
 * Tracks mouse position and raycasts each frame to detect what the cursor is
 * over. Two kinds of targets are supported: harbors (group userData) and
 * number-chip sprites (sprite userData).
 */
export class HoverSystem {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private pointerInside = false;
  private screenX = 0;
  private screenY = 0;
  private handler: HoverHandler | null = null;
  private lastState: HoverState | null = null;
  private currentTile: Tile | null = null;

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

  update(): void {
    if (!this.pointerInside) {
      this.emit(null);
      this.setHoveredTile(null);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hoverables as Object3D[], true);
    for (const hit of hits) {
      const obj = walkToKind(hit.object);
      if (!obj) continue;
      const kind = obj.userData['kind'];
      if (kind === 'harbor') {
        const harbor = obj.userData['harbor'] as Harbor;
        this.setHoveredTile(null);
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
        this.emit({
          target: { kind: 'chip', tile },
          screenX: this.screenX,
          screenY: this.screenY,
        });
        return;
      }
    }
    this.setHoveredTile(null);
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
        : this.lastState.target.kind === 'chip' &&
          this.lastState.target.tile === (state.target as { tile: Tile }).tile) &&
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
      if (obj.userData['kind'] === 'card') {
        const card = obj.userData['card'] as Card;
        card.toggle();
        return;
      }
    }
  };
}

function walkToKind(obj: Object3D): Object3D | null {
  let current: Object3D | null = obj;
  while (current) {
    if (current.userData && current.userData['kind']) return current;
    current = current.parent;
  }
  return null;
}
