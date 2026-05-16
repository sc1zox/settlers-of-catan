import {
  Color,
  Fog,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Timer,
  Vector3,
  DirectionalLight,
  VSMShadowMap,
  WebGLRenderer,
} from 'three';
import { shadowQualityPreset } from './scene/shadow-quality-preset';
import { ShadowQuality } from './scene/shadow-quality.enum';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BonusAwardKind,
  BuildKind,
  GamePhase,
  PlayerSeat,
  SceneUserDataKey,
} from '@catan/api-interfaces';
import type {
  LobbyScenePlayerState,
  LobbySceneState,
} from '../app/shared/helper/game-scene/lobby-scene-state';
import { Board } from './board/board';
import { BoardBuildings, type SpawnedBuildPiece } from './board/buildings';
import { RobberFigure } from './board/robber-figure';
import { BuildPreview } from './board/build-preview';
import { HEX_SIZE } from './board/hex';
import { Card } from './cards/card';
import { CardHoverGroup } from './shared/card-hover';
import { DevKind, ResourceKind } from './cards/textures';
import { DiceResultHandler, DiceTray } from './dice/dice-tray';
import { HoverHandler, HoverSystem } from './interaction/hover';
import { PLAYER_SEAT_ORDER, PlayerColor } from './players/colors';
import { PlayerArea } from './players/player-area';
import { CloudField } from './scene/clouds';
import { addLighting } from './scene/lighting';
import { SunShafts } from './scene/sun-shafts';
import { createCamera, createControls } from './scene/camera';
import { Table } from './table/table';
import { Tile } from './tiles/tile';
import { createHarbors, HarborSystem } from './world/harbors';
import { World } from './world/world';
import { legalIdsForKind } from './engine-runtime/build-flow';
import {
  BOARD_OVERLAY_UPDATE_BOUNDS_RADIUS,
  DICE_UPDATE_BOUNDS_RADIUS,
  INNER_STRIP_Z,
  OUTER_STRIP_Z,
  PLAYER_UPDATE_BOUNDS_RADIUS,
  TABLE_SIZE,
  TABLE_TOP_Y,
  TILE_UPDATE_BOUNDS_RADIUS,
} from './engine-runtime/constants';
import { BonusAwardFlight } from './engine-runtime/bonus-award-flight';
import { FocusCardFan } from './engine-runtime/focus-cards';
import { FrustumCull } from './engine-runtime/frustum-cull';
import { OrbitCameraAid } from './engine-runtime/orbit-camera';
import { PerfStatsAggregator } from './engine-runtime/perf-stats';
import { computeHandSignature, expandResourceHand } from './engine-runtime/resource-hand';
import type { PerformanceStatsHandler } from './engine-runtime/types';

export type { PerformanceSnapshot, PerformanceStatsHandler } from './engine-runtime/types';

export interface EngineOptions {
  readonly seed?: number;
}

export type ArsenalBuildHandler = (kind: BuildKind) => void;
export type BuildSpotPickHandler = (
  kind: BuildKind,
  id: string,
  screenX: number,
  screenY: number,
) => void;
export type RobberTilePickHandler = (
  q: number,
  r: number,
  screenX: number,
  screenY: number,
) => void;
export type BuildModeCancelHandler = () => void;

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly sunLight: DirectionalLight;
  private timer: Timer | null = null;
  private board: Board;
  private readonly world: World;
  private readonly harbors: HarborSystem;
  private readonly table: Table;
  private readonly sunShafts: SunShafts;
  private readonly clouds: CloudField;
  private readonly players: readonly PlayerArea[];
  private readonly diceTray: DiceTray;
  private readonly buildings: BoardBuildings;
  private readonly robberFigure: RobberFigure;
  private readonly buildPreview: BuildPreview;
  private readonly hover: HoverSystem;
  private readonly resizeObserver: ResizeObserver;

  private readonly frustumCull = new FrustumCull();
  private readonly orbitAid = new OrbitCameraAid();
  private readonly perfAggregator = new PerfStatsAggregator();
  private readonly focusFan = new FocusCardFan();
  private readonly bonusFlight = new BonusAwardFlight();

  private currentSeed: number | null = null;

  private rafId: number | null = null;
  private running = false;
  private focusChangeHandler: ((focused: boolean) => void) | null = null;

  private selfSeat: PlayerSeat | null = null;
  private legalSettlementVertexIds: readonly string[] = [];
  private legalRoadEdgeIds: readonly string[] = [];
  private legalCityVertexIds: readonly string[] = [];
  private legalRoadBuildingEdgeIds: readonly string[] = [];
  private buildMode: BuildKind | null = null;
  private buildModeFreeRoad = false;
  private arsenalBuildHandler: ArsenalBuildHandler | null = null;
  private pendingArsenalFigure: Object3D | null = null;
  private readonly flyInScratchPos = new Vector3();
  private readonly flyInScratchQuat = new Quaternion();
  private readonly flyInScratchScale = new Vector3();
  private buildSpotPickHandler: BuildSpotPickHandler | null = null;
  private robberTilePickHandler: RobberTilePickHandler | null = null;
  private buildModeCancelHandler: BuildModeCancelHandler | null = null;
  private devCardClickHandler: (() => void) | null = null;
  private diceRollRequestHandler: (() => void) | null = null;
  private diceRollClickEnabled = false;
  private hasFramedBoardForActiveMatch = false;

  private readonly handSignatureBySeat: string[] = ['', '', '', ''];
  private readonly playerAreaActiveAtTable: boolean[] = [false, false, false, false];

  constructor(container: HTMLElement, options: EngineOptions = {}) {
    this.container = container;

    this.scene = new Scene();
    this.scene.background = new Color(0xb89a78);
    this.scene.fog = new Fog(0xb89a78, 70, 200);

    const { clientWidth, clientHeight } = container;
    const aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera = createCamera(aspect);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = VSMShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = createControls(this.camera, this.renderer.domElement);

    const lighting = addLighting(this.scene, this.renderer);
    this.sunLight = lighting.sun;

    this.sunShafts = new SunShafts();
    this.scene.add(this.sunShafts.group);

    this.clouds = new CloudField();
    this.scene.add(this.clouds.group);

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

    this.players = this.createPlayers();
    for (const p of this.players) {
      this.scene.add(p.group);
    }

    this.diceTray = new DiceTray({
      tableTopY: TABLE_TOP_Y,
      anchor: { x: 14.5, z: 14.5 },
    });
    this.scene.add(this.diceTray.group);

    this.buildings = new BoardBuildings();
    this.scene.add(this.buildings.group);
    this.robberFigure = new RobberFigure(this.buildings.group);
    this.scene.add(this.robberFigure.group);

    this.buildPreview = new BuildPreview();
    this.scene.add(this.buildPreview.group);

    this.hover = new HoverSystem(this.renderer.domElement, this.camera, this.collectHoverables());
    this.hover.setCardClickHandler((card) => this.handleCardClick(card));
    this.hover.setDieClickHandler((_die) => {
      if (!this.diceRollClickEnabled) {
        return;
      }
      this.diceRollRequestHandler?.();
    });
    this.hover.setBackgroundClickHandler(() => {
      if (this.focusFan.getFocusedGroup().length > 0) {
        this.clearFocusedCard();
      }
      if (this.buildMode !== null) {
        this.buildModeCancelHandler?.();
      }
    });
    this.hover.setBuildSpotHoverHandler((figure) => this.buildPreview.setHovered(figure));
    this.hover.setArsenalClickHandler((figure) => {
      const kind = figure.userData[SceneUserDataKey.BuildKind] as BuildKind | undefined;
      if (kind !== undefined) {
        this.pendingArsenalFigure = figure;
        this.arsenalBuildHandler?.(kind);
      }
    });
    this.hover.setBuildSpotClickHandler((figure, screenX, screenY) => {
      const kind = figure.userData[SceneUserDataKey.BuildKind] as BuildKind | undefined;
      const id = figure.userData[SceneUserDataKey.BuildId] as string | undefined;
      if (kind !== undefined && id !== undefined) {
        this.buildSpotPickHandler?.(kind, id, screenX, screenY);
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  public start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    const timer = new Timer();
    timer.connect(this.container.ownerDocument);
    this.timer = timer;
    this.loop(performance.now());
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.timer?.dispose();
    this.timer = null;
  }

  public setHoverHandler(handler: HoverHandler | null): void {
    this.hover.setHandler(handler);
  }

  public setDiceResultHandler(handler: DiceResultHandler | null): void {
    this.diceTray.setResultHandler(handler);
  }

  public setFocusChangeHandler(handler: ((focused: boolean) => void) | null): void {
    this.focusChangeHandler = handler;
  }

  public setDiceRollRequestHandler(handler: (() => void) | null): void {
    this.diceRollRequestHandler = handler;
  }

  public setDiceRollClickEnabled(enabled: boolean): void {
    this.diceRollClickEnabled = enabled;
  }

  public setHeadVideoForSeat(
    seat: PlayerSeat,
    video: HTMLVideoElement | null,
    showNoCameraPlaceholder = false,
  ): void {
    const area = this.players[seat];
    if (!area) {
      return;
    }
    area.setHeadVideo(video, showNoCameraPlaceholder);
  }

  public setHeadVideoDisplayGamma(gamma: number): void {
    for (let i = 0; i < this.players.length; i += 1) {
      this.players[i].setHeadVideoDisplayGamma(gamma);
    }
  }

  public setSceneBrightness(brightness: number): void {
    this.renderer.toneMappingExposure = brightness;
  }

  public rollDiceTo(a: number, b: number): void {
    this.diceTray.rollTo(a, b);
  }

  public setArsenalBuildHandler(handler: ArsenalBuildHandler | null): void {
    this.arsenalBuildHandler = handler;
  }

  public setBuildSpotPickHandler(handler: BuildSpotPickHandler | null): void {
    this.buildSpotPickHandler = handler;
  }

  public setRobberTilePickHandler(handler: RobberTilePickHandler | null): void {
    this.robberTilePickHandler = handler;
  }

  public setBuildModeCancelHandler(handler: BuildModeCancelHandler | null): void {
    this.buildModeCancelHandler = handler;
  }

  public setDevCardClickHandler(handler: (() => void) | null): void {
    this.devCardClickHandler = handler;
  }

  public setPerformanceStatsHandler(handler: PerformanceStatsHandler | null): void {
    this.perfAggregator.setHandler(handler);
  }

  public setShadowQuality(quality: ShadowQuality): void {
    const preset = shadowQualityPreset(quality);
    this.renderer.shadowMap.enabled = preset.shadowsEnabled;
    this.sunLight.castShadow = preset.shadowsEnabled;
    if (!preset.shadowsEnabled) {
      return;
    }
    this.renderer.shadowMap.type = preset.shadowMapType;
    this.sunLight.shadow.mapSize.set(preset.mapSize, preset.mapSize);
    this.sunLight.shadow.radius = preset.shadowRadius;
    if (this.sunLight.shadow.map !== null) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  public setSpectatorCameraMode(active: boolean): void {
    if (active === this.orbitAid.isSpectatorActive()) {
      return;
    }
    if (active) {
      this.focusFan.clearRest(this.focusChangeHandler);
    }
    this.orbitAid.setSpectatorCameraMode(active, this.controls);
    this.hover.setExploreReadOnly(active);
    this.hover.setHoverables(this.collectHoverables());
  }

  public showBuildSpots(kind: BuildKind | null, freeRoad = false): void {
    this.buildMode = kind;
    this.buildModeFreeRoad = freeRoad;
    if (kind === null) {
      this.buildPreview.clear();
    } else {
      this.buildPreview.show(kind, this.resolveLegalIds(kind), this.selfColor());
    }
    this.updateActivatedArsenalFigure();
    this.hover.setHoverables(this.collectHoverables());
  }

  private updateActivatedArsenalFigure(): void {
    if (this.selfSeat === null) {
      return;
    }
    const selfArea = this.players[this.selfSeat];
    if (!selfArea) {
      return;
    }
    const figure =
      this.buildMode !== null && !this.buildModeFreeRoad ? this.pendingArsenalFigure : null;
    selfArea.setActivatedArsenalFigure(figure);
  }

  private canFlyInArsenalFigure(kind: BuildKind, seat: PlayerSeat): boolean {
    if (this.selfSeat === null || seat !== this.selfSeat) {
      return false;
    }
    return this.players[this.selfSeat]?.hasActivatedArsenalFigure(kind) ?? false;
  }

  private startArsenalFlyIn(piece: SpawnedBuildPiece): void {
    if (this.selfSeat === null) {
      return;
    }
    const selfArea = this.players[this.selfSeat];
    if (!selfArea) {
      return;
    }
    piece.figure.updateWorldMatrix(true, false);
    piece.figure.getWorldPosition(this.flyInScratchPos);
    piece.figure.getWorldQuaternion(this.flyInScratchQuat);
    piece.figure.getWorldScale(this.flyInScratchScale);
    selfArea.flyActivatedFigureToWorld(
      this.flyInScratchPos,
      this.flyInScratchQuat,
      this.flyInScratchScale,
      () => this.buildings.revealPiece(piece.kind, piece.id),
    );
  }

  public setRobberMode(active: boolean): void {
    if (active) {
      this.hover.setTileClickHandler((chip, screenX, screenY) => {
        const tile = chip.userData[SceneUserDataKey.Tile] as Tile | undefined;
        if (tile) {
          this.robberTilePickHandler?.(tile.coord.q, tile.coord.r, screenX, screenY);
        }
      });
    } else {
      this.hover.setTileClickHandler(null);
    }
  }

  private resolveLegalIds(kind: BuildKind): readonly string[] {
    return legalIdsForKind(
      kind,
      this.legalSettlementVertexIds,
      this.legalRoadEdgeIds,
      this.legalCityVertexIds,
      this.legalRoadBuildingEdgeIds,
      this.buildModeFreeRoad,
    );
  }

  private selfColor(): number {
    const seat = this.selfSeat;
    if (seat === null) {
      return PLAYER_SEAT_ORDER[0];
    }
    return PLAYER_SEAT_ORDER[seat] ?? PLAYER_SEAT_ORDER[0];
  }

  public clearFocusedCard(): void {
    this.focusFan.clearRest(this.focusChangeHandler);
  }

  /**
   * Trigger the "Längste Handelsstraße / Größte Rittermacht" presentation.
   * The card hovers in front of the recipient (for them it fills the screen;
   * for everyone else it floats by their avatar) for ~2 seconds, then settles
   * onto the table next to their hand. Idempotent re-emits restart the flight.
   */
  public playBonusAward(kind: BonusAwardKind, recipientSeat: PlayerSeat): void {
    const area = this.players[recipientSeat];
    if (!area || !this.playerAreaActiveAtTable[recipientSeat]) {
      return;
    }
    const card = area.setBonusCard(kind, true);
    if (!card) {
      return;
    }
    this.bonusFlight.start(card, kind, recipientSeat, recipientSeat === this.selfSeat);
    this.hover.setHoverables(this.collectHoverables());
  }

  public dispose(): void {
    this.stop();
    this.bonusFlight.clearAll();
    this.orbitAid.resetSpectator(this.controls);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.hover.dispose();
    this.board.dispose();
    this.world.dispose();
    this.table.dispose();
    this.sunShafts.dispose();
    this.clouds.dispose();
    this.diceTray.dispose();
    this.robberFigure.dispose();
    this.buildings.dispose();
    this.buildPreview.dispose();
    for (const p of this.players) {
      p.dispose();
    }
    this.scene.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  public applySceneState(state: LobbySceneState): void {
    for (let s = 0; s < this.playerAreaActiveAtTable.length; s += 1) {
      this.playerAreaActiveAtTable[s] = false;
    }
    for (let i = 0; i < state.players.length; i += 1) {
      const seat = state.players[i].seat;
      if (seat >= 0 && seat < this.playerAreaActiveAtTable.length) {
        this.playerAreaActiveAtTable[seat] = true;
      }
    }
    for (let s = 0; s < this.players.length; s += 1) {
      if (!this.playerAreaActiveAtTable[s]) {
        this.players[s].setHeadVideo(null);
      }
    }
    this.buildings.setLobbySeatMask(this.playerAreaActiveAtTable);
    if (state.phase === GamePhase.LobbyWaiting) {
      this.hasFramedBoardForActiveMatch = false;
    }
    let boardJustRebuilt = false;
    if (state.seed !== this.currentSeed) {
      boardJustRebuilt = true;
      this.rebuildBoard(state.seed);
      this.currentSeed = state.seed;
      this.hasFramedBoardForActiveMatch = false;
    }
    const self = state.players.find((p: LobbyScenePlayerState) => p.isSelf);
    this.selfSeat = self ? self.seat : null;
    this.legalSettlementVertexIds = state.legalSettlementVertexIds;
    this.legalRoadEdgeIds = state.legalRoadEdgeIds;
    this.legalCityVertexIds = state.legalCityVertexIds;
    this.legalRoadBuildingEdgeIds = state.legalRoadBuildingEdgeIds;
    const flyIns = this.buildings.syncToState(state.settlements, state.roads, (kind, seat) =>
      this.canFlyInArsenalFigure(kind, seat),
    );
    for (let i = 0; i < flyIns.length; i += 1) {
      this.startArsenalFlyIn(flyIns[i]);
    }
    this.robberFigure.syncCoord(state.robberCoord.q, state.robberCoord.r, boardJustRebuilt);
    for (let i = 0; i < state.players.length; i += 1) {
      const playerState = state.players[i];
      const area = this.players[playerState.seat];
      if (!area || !this.playerAreaActiveAtTable[playerState.seat]) {
        continue;
      }
      area.setDisplayName(playerState.displayName);
      const handSignature = computeHandSignature(playerState.resources, playerState.devCardsInHand);
      if (this.handSignatureBySeat[playerState.seat] !== handSignature) {
        area.setHand(expandResourceHand(playerState.resources), playerState.devCardsInHand);
        this.handSignatureBySeat[playerState.seat] = handSignature;
      }
    }
    this.syncBonusCardOwnership(state.longestRoadSeat, BonusAwardKind.LongestRoad);
    this.syncBonusCardOwnership(state.largestArmySeat, BonusAwardKind.LargestArmy);
    if (this.buildMode !== null) {
      this.buildPreview.show(
        this.buildMode,
        this.resolveLegalIds(this.buildMode),
        this.selfColor(),
      );
    }
    this.hover.setHoverables(this.collectHoverables());
    if (
      !this.hasFramedBoardForActiveMatch &&
      state.phase !== GamePhase.LobbyWaiting &&
      state.phase !== GamePhase.Finished
    ) {
      this.orbitAid.applyMatchStartCameraFraming(this.camera, this.controls);
      this.hasFramedBoardForActiveMatch = true;
    }
  }

  /**
   * Mirror the server-authoritative bonus-card holder into the player areas.
   * Each player area owns at most one card per kind; this drops it from
   * anyone who no longer holds it and creates a resting card on the new
   * holder so reconnecting clients see the right table state without needing
   * a `BonusAwarded` event.
   */
  private syncBonusCardOwnership(holderSeat: PlayerSeat | null, kind: BonusAwardKind): void {
    for (let i = 0; i < this.players.length; i += 1) {
      const owned = holderSeat !== null && holderSeat === i && this.playerAreaActiveAtTable[i];
      if (!owned) {
        // Cancel any in-flight animation before the card mesh is disposed —
        // otherwise the flight keeps poking a freed `Card` until it times out.
        this.bonusFlight.cancel(kind, i as PlayerSeat);
      }
      this.players[i].setBonusCard(kind, owned);
    }
  }

  private rebuildBoard(seed: number): void {
    this.scene.remove(this.board.group);
    this.board.dispose();
    this.board = new Board({ seed });
    this.scene.add(this.board.group);
  }

  private collectHoverables(): Object3D[] {
    const hoverables: Object3D[] = [];
    for (const tile of this.board.tiles) {
      const sprite = tile.getChipSprite();
      if (sprite) {
        hoverables.push(sprite);
      }
    }
    for (let i = 0; i < this.harbors.harbors.length; i += 1) {
      hoverables.push(this.harbors.harbors[i].pickMesh);
    }
    const spectator = this.orbitAid.isSpectatorActive();
    for (let i = 0; i < this.players.length; i += 1) {
      const player = this.players[i];
      if (!this.playerAreaActiveAtTable[player.info.seat]) {
        continue;
      }
      if (spectator) {
        if (this.selfSeat === null || player.info.seat !== this.selfSeat) {
          continue;
        }
        for (let j = 0; j < player.cards.length; j += 1) {
          hoverables.push(player.cards[j].mesh);
        }
        continue;
      }
      if (this.selfSeat !== null && player.info.seat === this.selfSeat) {
        for (let j = 0; j < player.cards.length; j += 1) {
          hoverables.push(player.cards[j].mesh);
        }
      } else {
        hoverables.push(player.getCostCard().mesh);
      }
    }
    if (!spectator) {
      for (let i = 0; i < this.diceTray.dice.length; i += 1) {
        hoverables.push(this.diceTray.dice[i].mesh);
      }
    }
    if (!spectator) {
      const previewHover = this.buildPreview.hoverables();
      for (let i = 0; i < previewHover.length; i += 1) {
        hoverables.push(previewHover[i]);
      }
    }
    if (this.selfSeat !== null && this.playerAreaActiveAtTable[this.selfSeat]) {
      const selfArea = this.players[this.selfSeat];
      if (selfArea) {
        for (let i = 0; i < selfArea.arsenal.length; i += 1) {
          hoverables.push(selfArea.arsenal[i]);
        }
      }
    }
    return hoverables;
  }

  private cardIsInspectable(card: Card): boolean {
    if (this.orbitAid.isSpectatorActive()) {
      if (this.selfSeat === null) {
        return false;
      }
      return this.players[this.selfSeat]?.cards.includes(card) ?? false;
    }
    for (let i = 0; i < this.players.length; i += 1) {
      if (!this.playerAreaActiveAtTable[i]) {
        continue;
      }
      if (this.players[i].getCostCard() === card) {
        return true;
      }
    }
    if (this.selfSeat === null) {
      return false;
    }
    return this.players[this.selfSeat]?.ownsHandCard(card) ?? false;
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
    for (let seat = 0; seat < 4; seat += 1) {
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
    if (!this.cardIsInspectable(card)) {
      return;
    }
    const info = card.getHoverInfo();
    if (
      info?.group === CardHoverGroup.Development &&
      this.selfSeat !== null &&
      this.players[this.selfSeat]?.cards.includes(card)
    ) {
      this.devCardClickHandler?.();
      return;
    }

    const fg = this.focusFan.getFocusedGroup();
    const sameGroupAlreadyFocused =
      fg.length > 0 &&
      fg[0].getGroupKey() === card.getGroupKey() &&
      (card.getGroupKey() !== null || fg.includes(card));

    if (sameGroupAlreadyFocused) {
      this.clearFocusedCard();
      return;
    }

    const members = this.collectGroupMembers(card);
    this.focusFan.commitFocusedMembers(members, this.focusChangeHandler);
  }

  private collectGroupMembers(card: Card): Card[] {
    const key = card.getGroupKey();
    if (key === null) {
      return [card];
    }
    const out: Card[] = [];
    for (let i = 0; i < this.players.length; i += 1) {
      const player = this.players[i];
      if (!this.playerAreaActiveAtTable[player.info.seat]) {
        continue;
      }
      for (let j = 0; j < player.cards.length; j += 1) {
        const c = player.cards[j];
        if (c.getGroupKey() === key) {
          out.push(c);
        }
      }
    }
    return out.length > 0 ? out : [card];
  }

  private readonly loop = (time: number): void => {
    if (!this.running || this.timer === null) {
      return;
    }
    this.timer.update(time);
    const dt = this.timer.getDelta();
    const t = this.timer.getElapsed();
    this.frustumCull.update(this.camera);
    let visibleTiles = 0;
    for (let i = 0; i < this.board.tiles.length; i += 1) {
      const tile = this.board.tiles[i];
      const visible = this.frustumCull.intersectsObject(tile.group, TILE_UPDATE_BOUNDS_RADIUS);
      tile.group.visible = visible;
      if (visible) {
        visibleTiles += 1;
        tile.update(dt, t);
      }
    }
    this.world.update(dt, t);
    this.sunShafts.update(dt, t);
    this.clouds.update(dt, t);
    const boardOverlayVisible = this.frustumCull.intersectsOrigin(
      BOARD_OVERLAY_UPDATE_BOUNDS_RADIUS,
    );
    this.buildings.group.visible = boardOverlayVisible;
    this.robberFigure.group.visible = boardOverlayVisible;
    this.buildPreview.group.visible = boardOverlayVisible;
    if (boardOverlayVisible) {
      this.buildings.update(dt);
      this.robberFigure.update(dt);
      this.buildPreview.update(dt);
    }
    const diceVisible = this.frustumCull.intersectsObject(
      this.diceTray.group,
      DICE_UPDATE_BOUNDS_RADIUS,
    );
    this.diceTray.group.visible = diceVisible;
    if (diceVisible) {
      this.diceTray.update(dt);
    }
    let visibleHarbors = 0;
    for (let i = 0; i < this.harbors.harbors.length; i += 1) {
      const harbor = this.harbors.harbors[i];
      const visible = this.frustumCull.intersectsObject(harbor.group, TILE_UPDATE_BOUNDS_RADIUS);
      harbor.group.visible = visible;
      if (visible) {
        visibleHarbors += 1;
      }
    }
    const cameraChanged = this.controls.update();
    this.orbitAid.clampOrbitTarget(this.camera, this.controls);
    this.focusFan.update(this.camera);
    this.bonusFlight.update(dt, this.camera, this.players);
    let visiblePlayers = 0;
    let activePlayersTotal = 0;
    for (let i = 0; i < this.players.length; i += 1) {
      const player = this.players[i];
      if (this.playerAreaActiveAtTable[i]) {
        activePlayersTotal += 1;
      }
      const visible =
        this.playerAreaActiveAtTable[i] &&
        this.frustumCull.intersectsObject(player.group, PLAYER_UPDATE_BOUNDS_RADIUS);
      player.group.visible = visible;
      if (visible) {
        visiblePlayers += 1;
        player.update(dt);
      }
    }
    this.hover.update(cameraChanged);
    this.renderer.render(this.scene, this.camera);
    this.perfAggregator.recordVisibility({
      visibleTiles,
      visibleHarbors,
      visiblePlayers,
      activePlayersTotal,
      boardOverlayVisible,
      diceVisible,
    });
    this.perfAggregator.tick(
      dt,
      this.renderer,
      this.board.tiles.length,
      this.harbors.harbors.length,
    );
    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleResize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }
}
