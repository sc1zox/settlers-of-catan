import {
  Clock,
  Color,
  Fog,
  Matrix4,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Board } from './board/board';
import { HEX_SIZE } from './board/hex';
import { Card } from './cards/card';
import { DevKind, ResourceKind } from './cards/textures';
import { DiceResultHandler, DiceTray } from './dice/dice-tray';
import { HoverHandler, HoverSystem } from './interaction/hover';
import { PLAYER_SEAT_ORDER, PlayerColor } from './players/colors';
import { PlayerArea } from './players/player-area';
import { addLighting } from './scene/lighting';
import { createCamera, createControls } from './scene/camera';
import { Table } from './table/table';
import { createHarbors, HarborSystem } from './world/harbors';
import { World } from './world/world';

export interface EngineOptions {
  readonly seed?: number;
}

const TABLE_TOP_Y = -3.5;
const TABLE_SIZE = 44;
const INNER_STRIP_Z = 17.2;
const OUTER_STRIP_Z = 21.4;

/** Rotation that maps a card's local -Y face into the camera's local +Z view direction. */
const CARD_FACE_TO_CAMERA = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
/** Fraction of the view dimensions a focused group should occupy — higher = more foreground. */
const FOCUS_FILL_RATIO = 0.62;
/** Spacing between siblings in a focused group, expressed as a fraction of card-X width. */
const FOCUS_GROUP_SPACING_FACTOR = 0.55;
/** Hard floor on focus distance to keep cards out of the camera's near plane. */
const FOCUS_MIN_DISTANCE = 0.9;

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly clock: Clock;
  private readonly board: Board;
  private readonly world: World;
  private readonly harbors: HarborSystem;
  private readonly table: Table;
  private readonly players: readonly PlayerArea[];
  private readonly diceTray: DiceTray;
  private readonly hover: HoverSystem;
  private readonly resizeObserver: ResizeObserver;

  private rafId: number | null = null;
  private running = false;
  private focusedGroup: Card[] = [];
  private focusChangeHandler: ((focused: boolean) => void) | null = null;

  // Reusable scratch values for the per-frame focused-card pose calculation.
  private readonly camForward = new Vector3();
  private readonly camRight = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly worldTargetPos = new Vector3();
  private readonly worldTargetQuat = new Quaternion();
  private readonly parentInvMatrix = new Matrix4();
  private readonly parentInvQuat = new Quaternion();
  private readonly localTargetPos = new Vector3();
  private readonly localTargetQuat = new Quaternion();

  constructor(container: HTMLElement, options: EngineOptions = {}) {
    this.container = container;

    this.scene = new Scene();
    this.scene.background = new Color(0x161219);
    this.scene.fog = new Fog(0x161219, 60, 180);

    const { clientWidth, clientHeight } = container;
    const aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera = createCamera(aspect);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = createControls(this.camera, this.renderer.domElement);

    addLighting(this.scene);

    // Tabletop the disc hovers over.
    const discRadius = HEX_SIZE * 6.4;
    this.table = new Table({
      size: TABLE_SIZE,
      topY: TABLE_TOP_Y,
      glowRadius: discRadius + 1.0,
    });
    this.scene.add(this.table.group);

    this.world = new World({ discRadius, tableTopY: TABLE_TOP_Y });
    this.scene.add(this.world.group);

    this.board = new Board({ seed: options.seed });
    this.scene.add(this.board.group);

    this.harbors = createHarbors();
    this.scene.add(this.harbors.group);

    // Four players around the table with starter hands.
    this.players = this.createPlayers();
    for (const p of this.players) this.scene.add(p.group);

    // Dice rest on the tabletop in a corner clear of the disc and player strips.
    this.diceTray = new DiceTray({
      tableTopY: TABLE_TOP_Y,
      anchor: { x: 14.5, z: 14.5 },
    });
    this.scene.add(this.diceTray.group);

    const hoverables: Object3D[] = [];
    for (const tile of this.board.tiles) {
      const sprite = tile.getChipSprite();
      if (sprite) hoverables.push(sprite);
    }
    for (const harbor of this.harbors.harbors) hoverables.push(harbor.pickMesh);
    for (const player of this.players) {
      for (const card of player.cards) hoverables.push(card.mesh);
    }
    for (const die of this.diceTray.dice) hoverables.push(die.mesh);
    this.hover = new HoverSystem(this.renderer.domElement, this.camera, hoverables);
    this.hover.setCardClickHandler((card) => this.handleCardClick(card));
    this.hover.setDieClickHandler((_die) => this.diceTray.rollBoth());

    this.clock = new Clock(false);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clock.stop();
  }

  setHoverHandler(handler: HoverHandler | null): void {
    this.hover.setHandler(handler);
  }

  setDiceResultHandler(handler: DiceResultHandler | null): void {
    this.diceTray.setResultHandler(handler);
  }

  /** Notified when a card is focused / unfocused — used to drive a backdrop. */
  setFocusChangeHandler(handler: ((focused: boolean) => void) | null): void {
    this.focusChangeHandler = handler;
  }

  /** External "roll the dice" button (UI overlay). */
  rollDice(): void {
    this.diceTray.rollBoth();
  }

  /** Release the focused group back to its resting place (e.g., backdrop click). */
  clearFocusedCard(): void {
    if (this.focusedGroup.length === 0) return;
    for (const c of this.focusedGroup) c.setMode('rest');
    this.focusedGroup = [];
    this.focusChangeHandler?.(false);
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.hover.dispose();
    this.board.dispose();
    this.world.dispose();
    this.table.dispose();
    this.diceTray.dispose();
    for (const p of this.players) p.dispose();
    this.scene.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private createPlayers(): readonly PlayerArea[] {
    const starterResource: readonly ResourceKind[][] = [
      [ResourceKind.Wood, ResourceKind.Brick, ResourceKind.Wool],
      [ResourceKind.Grain, ResourceKind.Ore, ResourceKind.Wood],
      [ResourceKind.Wool, ResourceKind.Grain, ResourceKind.Brick],
      [ResourceKind.Ore, ResourceKind.Wood, ResourceKind.Grain],
    ];
    const starterDev: readonly DevKind[][] = [
      [DevKind.Knight, DevKind.YearOfPlenty],
      [DevKind.RoadBuilding, DevKind.Knight],
      [DevKind.Monopoly, DevKind.VictoryPoint],
      [DevKind.Knight, DevKind.RoadBuilding],
    ];
    const players: PlayerArea[] = [];
    for (let seat = 0; seat < 4; seat++) {
      const color: PlayerColor = PLAYER_SEAT_ORDER[seat];
      players.push(
        new PlayerArea({
          color,
          seat: seat as 0 | 1 | 2 | 3,
          tableTopY: TABLE_TOP_Y,
          innerEdgeZ: INNER_STRIP_Z,
          outerEdgeZ: OUTER_STRIP_Z,
          resourceHand: starterResource[seat],
          devHand: starterDev[seat],
        }),
      );
    }
    return players;
  }

  private handleCardClick(card: Card): void {
    const sameGroupAlreadyFocused =
      this.focusedGroup.length > 0 &&
      this.focusedGroup[0].getGroupKey() === card.getGroupKey() &&
      // null group keys never match each other — fall back to identity instead.
      (card.getGroupKey() !== null || this.focusedGroup.includes(card));

    if (sameGroupAlreadyFocused) {
      this.clearFocusedCard();
      return;
    }

    for (const c of this.focusedGroup) c.setMode('rest');
    const members = this.collectGroupMembers(card);
    for (let i = 0; i < members.length; i++) {
      members[i].setMode('focused');
      // Right-most card draws on top — natural reading order for a fanned hand.
      members[i].mesh.renderOrder = 999 + i;
    }
    this.focusedGroup = members;
    this.focusChangeHandler?.(true);
  }

  private collectGroupMembers(card: Card): Card[] {
    const key = card.getGroupKey();
    if (key === null) return [card];
    const out: Card[] = [];
    for (const player of this.players) {
      for (const c of player.cards) {
        if (c.getGroupKey() === key) out.push(c);
      }
    }
    return out.length > 0 ? out : [card];
  }

  /**
   * Per-frame: position every focused card along a horizontal fan in front of
   * the camera. Distance is picked so the largest member's vertical extent and
   * the whole fan's horizontal span both fit `FOCUS_FILL_RATIO` of the view.
   */
  private updateFocusedCards(): void {
    if (this.focusedGroup.length === 0) return;

    this.camera.getWorldDirection(this.camForward);
    // Build an orthonormal camera basis from world-up. Using the OrbitControls
    // setup the camera never rolls, so this stays stable.
    this.camRight.crossVectors(this.camForward, this.worldUp).normalize();

    let maxX = 0;
    let maxZ = 0;
    for (const c of this.focusedGroup) {
      const s = c.getLocalSize();
      if (s.x > maxX) maxX = s.x;
      if (s.z > maxZ) maxZ = s.z;
    }
    const spacing = maxX * FOCUS_GROUP_SPACING_FACTOR;
    const span = (this.focusedGroup.length - 1) * spacing + maxX;

    const halfTan = Math.tan((this.camera.fov * Math.PI) / 360);
    const aspect = this.camera.aspect;
    const distanceForHeight = maxZ / (2 * halfTan * FOCUS_FILL_RATIO);
    const distanceForWidth = span / (2 * halfTan * aspect * FOCUS_FILL_RATIO);
    const distance = Math.max(distanceForHeight, distanceForWidth, FOCUS_MIN_DISTANCE);

    this.worldTargetQuat.copy(this.camera.quaternion).multiply(CARD_FACE_TO_CAMERA);

    const half = (this.focusedGroup.length - 1) / 2;
    for (let i = 0; i < this.focusedGroup.length; i++) {
      const card = this.focusedGroup[i];
      const parent = card.mesh.parent;
      if (!parent) continue;

      const offset = (i - half) * spacing;
      this.worldTargetPos
        .copy(this.camForward)
        .multiplyScalar(distance)
        .add(this.camera.position)
        .addScaledVector(this.camRight, offset);

      parent.updateWorldMatrix(true, false);
      this.parentInvMatrix.copy(parent.matrixWorld).invert();
      this.localTargetPos.copy(this.worldTargetPos).applyMatrix4(this.parentInvMatrix);

      parent.getWorldQuaternion(this.parentInvQuat).invert();
      this.localTargetQuat.copy(this.parentInvQuat).multiply(this.worldTargetQuat);

      card.setLiveTarget(this.localTargetPos, this.localTargetQuat);
    }
  }

  private readonly loop = (): void => {
    if (!this.running) return;
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;
    this.board.update(dt, t);
    this.world.update(dt, t);
    this.diceTray.update(dt);
    this.controls.update();
    this.updateFocusedCards();
    for (const player of this.players) player.update(dt);
    this.hover.update();
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleResize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }
}
