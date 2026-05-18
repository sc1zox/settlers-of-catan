import { BufferGeometry, Group, Mesh, Vector3 } from 'three';
import { BuildKind, PlayerSeat } from '@catan/api-interfaces';
import type { LobbyRoadDto, LobbySettlementDto } from '@catan/api-interfaces';
import {
  createFigureMaterials,
  disposeFigureMaterials,
  makeCity,
  makeRoad,
  makeSettlement,
  PlayerFigureMaterials,
} from '../players/figures';
import { PLAYER_SEAT_ORDER } from '../players/colors';
import { TILE_HEIGHT } from '../tiles/tile';
import { edgeIdToWorld, vertexIdToWorld } from './board-coords';
import { BuildAnimation } from './build-animation';

const SETTLEMENT_SCALE = 1.7;
const CITY_SCALE = 1.7;
const ROAD_WIDTH_SCALE = 1.7;
/** Local X length of the road bar from `makeRoad`. */
const ROAD_BAR_LENGTH = 0.55;
/** Fraction of the edge a road bar spans, leaving a gap at each vertex. */
const ROAD_EDGE_FILL = 0.74;

interface PlacedSettlement {
  readonly group: Group;
  isCity: boolean;
  readonly seat: PlayerSeat;
  visibleIntent: boolean;
}

interface PlacedRoad {
  readonly group: Group;
  readonly seat: PlayerSeat;
  visibleIntent: boolean;
}

/**
 * A piece that was just spawned hidden so the engine can fly the player's
 * arsenal figure into it; `revealPiece` makes it appear with the pop-in.
 */
export interface SpawnedBuildPiece {
  readonly kind: BuildKind;
  /** Vertex id (settlement / city) or edge id (road). */
  readonly id: string;
  readonly seat: PlayerSeat;
  readonly figure: Group;
}

/** Decides whether a newly spawned piece should be flown in instead of popped in. */
export type FlyInPredicate = (kind: BuildKind, seat: PlayerSeat) => boolean;

/**
 * Server-authoritative board overlay: renders settlements, cities and roads at
 * their vertex / edge world positions and plays a construction animation each
 * time a new piece appears in the lobby state. Owned by `GameEngine`; updated
 * every frame and disposed with the engine.
 */
export class BoardBuildings {
  readonly group: Group = new Group();

  private readonly settlements = new Map<string, PlacedSettlement>();
  private readonly roads = new Map<string, PlacedRoad>();
  private readonly animations: BuildAnimation[] = [];
  private readonly materialsBySeat = new Map<PlayerSeat, PlayerFigureMaterials>();
  private readonly trackedGeometries: BufferGeometry[] = [];
  private readonly lobbySeatMask: boolean[] = [false, false, false, false];

  /**
   * Full reconciliation against the server's truth: the lobby's settlements /
   * roads arrays *are* the rendered set. Pieces missing from the incoming DTO
   * are removed; new pieces spawn with a pop-in (or hidden, if `shouldFlyIn`
   * claims them, so the caller can fly an arsenal figure in and later call
   * `revealPiece`). No external reset signal is needed — switching lobbies
   * just sends a payload without the old vertex/edge ids and they vanish here.
   */
  syncToState(
    settlements: readonly LobbySettlementDto[],
    roads: readonly LobbyRoadDto[],
    shouldFlyIn?: FlyInPredicate,
  ): SpawnedBuildPiece[] {
    const flyIns: SpawnedBuildPiece[] = [];
    const presentVertexIds = new Set<string>();
    for (let i = 0; i < settlements.length; i += 1) {
      const dto = settlements[i];
      presentVertexIds.add(dto.vertexId);
      const existing = this.settlements.get(dto.vertexId);
      if (!existing) {
        const kind = dto.isCity ? BuildKind.City : BuildKind.Settlement;
        const fly = shouldFlyIn?.(kind, dto.seat) ?? false;
        const figure = this.spawnSettlement(dto, fly);
        if (fly) flyIns.push({ kind, id: dto.vertexId, seat: dto.seat, figure });
      } else if (existing.seat !== dto.seat) {
        this.removePiece(existing.group);
        this.settlements.delete(dto.vertexId);
        const kind = dto.isCity ? BuildKind.City : BuildKind.Settlement;
        const fly = shouldFlyIn?.(kind, dto.seat) ?? false;
        const figure = this.spawnSettlement(dto, fly);
        if (fly) flyIns.push({ kind, id: dto.vertexId, seat: dto.seat, figure });
      } else if (dto.isCity && !existing.isCity) {
        const fly = shouldFlyIn?.(BuildKind.City, dto.seat) ?? false;
        const figure = this.upgradeToCity(dto, existing, fly);
        if (fly) {
          flyIns.push({ kind: BuildKind.City, id: dto.vertexId, seat: dto.seat, figure });
        }
      }
    }
    for (const [vertexId, placed] of this.settlements) {
      if (!presentVertexIds.has(vertexId)) {
        this.removePiece(placed.group);
        this.settlements.delete(vertexId);
      }
    }
    const presentEdgeIds = new Set<string>();
    for (let i = 0; i < roads.length; i += 1) {
      const dto = roads[i];
      presentEdgeIds.add(dto.edgeId);
      const existingRoad = this.roads.get(dto.edgeId);
      if (existingRoad === undefined) {
        const fly = shouldFlyIn?.(BuildKind.Road, dto.seat) ?? false;
        const figure = this.spawnRoad(dto, fly);
        if (fly) flyIns.push({ kind: BuildKind.Road, id: dto.edgeId, seat: dto.seat, figure });
      } else if (existingRoad.seat !== dto.seat) {
        this.removePiece(existingRoad.group);
        this.roads.delete(dto.edgeId);
        const fly = shouldFlyIn?.(BuildKind.Road, dto.seat) ?? false;
        const figure = this.spawnRoad(dto, fly);
        if (fly) flyIns.push({ kind: BuildKind.Road, id: dto.edgeId, seat: dto.seat, figure });
      }
    }
    for (const [edgeId, placed] of this.roads) {
      if (!presentEdgeIds.has(edgeId)) {
        this.removePiece(placed.group);
        this.roads.delete(edgeId);
      }
    }
    return flyIns;
  }

  public setLobbySeatMask(activeAtSeat: readonly boolean[]): void {
    for (let i = 0; i < 4; i += 1) {
      this.lobbySeatMask[i] = activeAtSeat[i] ?? false;
    }
    for (const placed of this.settlements.values()) {
      placed.group.visible = this.effectivePieceVisible(placed.seat, placed.visibleIntent);
    }
    for (const placed of this.roads.values()) {
      placed.group.visible = this.effectivePieceVisible(placed.seat, placed.visibleIntent);
    }
  }

  /**
   * Make a piece spawned hidden by `syncToState` visible, playing the standard
   * construction pop-in (and dust) as it appears.
   */
  revealPiece(kind: BuildKind, id: string): void {
    if (kind === BuildKind.Road) {
      const placed = this.roads.get(id);
      if (!placed) {
        return;
      }
      placed.visibleIntent = true;
      placed.group.visible = this.effectivePieceVisible(placed.seat, true);
      if (placed.group.visible) {
        this.spawnBuildAnimation(placed.group);
      }
      return;
    }
    const placed = this.settlements.get(id);
    if (!placed) {
      return;
    }
    placed.visibleIntent = true;
    placed.group.visible = this.effectivePieceVisible(placed.seat, true);
    if (placed.group.visible) {
      this.spawnBuildAnimation(placed.group);
    }
  }

  update(dt: number): void {
    for (let i = this.animations.length - 1; i >= 0; i -= 1) {
      const animation = this.animations[i];
      animation.update(dt);
      if (animation.isDone()) {
        animation.dispose();
        this.animations.splice(i, 1);
      }
    }
  }

  /**
   * Drop every placed piece and material cache without tearing down the group.
   * Used when the canonical lobby changes so a reused board seed cannot keep
   * stale owner colours from the previous match.
   */
  public resetForNewLobby(): void {
    for (let i = this.animations.length - 1; i >= 0; i -= 1) {
      this.animations[i].dispose();
      this.animations.splice(i, 1);
    }
    for (const placed of this.settlements.values()) {
      this.group.remove(placed.group);
      this.releaseGeometries(placed.group);
    }
    for (const placed of this.roads.values()) {
      this.group.remove(placed.group);
      this.releaseGeometries(placed.group);
    }
    this.settlements.clear();
    this.roads.clear();
    for (const materials of this.materialsBySeat.values()) {
      disposeFigureMaterials(materials);
    }
    this.materialsBySeat.clear();
    for (let i = 0; i < this.lobbySeatMask.length; i += 1) {
      this.lobbySeatMask[i] = false;
    }
  }

  dispose(): void {
    this.resetForNewLobby();
    for (let i = 0; i < this.trackedGeometries.length; i += 1) {
      this.trackedGeometries[i].dispose();
    }
    this.trackedGeometries.length = 0;
    this.group.clear();
  }

  private spawnSettlement(dto: LobbySettlementDto, fly: boolean): Group {
    const figure = makeSettlement(this.materialsForSeat(dto.seat));
    const world = vertexIdToWorld(dto.vertexId);
    figure.position.set(world.x, TILE_HEIGHT, world.z);
    figure.scale.setScalar(SETTLEMENT_SCALE);
    const visibleIntent = !fly;
    this.placePiece(figure, visibleIntent, dto.seat);
    this.settlements.set(dto.vertexId, {
      group: figure,
      isCity: false,
      seat: dto.seat,
      visibleIntent,
    });
    return figure;
  }

  private upgradeToCity(dto: LobbySettlementDto, existing: PlacedSettlement, fly: boolean): Group {
    this.group.remove(existing.group);
    this.releaseGeometries(existing.group);
    const figure = makeCity(this.materialsForSeat(dto.seat));
    const world = vertexIdToWorld(dto.vertexId);
    figure.position.set(world.x, TILE_HEIGHT, world.z);
    figure.scale.setScalar(CITY_SCALE);
    const visibleIntent = !fly;
    this.placePiece(figure, visibleIntent, dto.seat);
    this.settlements.set(dto.vertexId, {
      group: figure,
      isCity: true,
      seat: dto.seat,
      visibleIntent,
    });
    return figure;
  }

  private spawnRoad(dto: LobbyRoadDto, fly: boolean): Group {
    const figure = makeRoad(this.materialsForSeat(dto.seat));
    const edge = edgeIdToWorld(dto.edgeId);
    figure.position.set(edge.position.x, TILE_HEIGHT, edge.position.z);
    figure.rotation.y = edge.angle;
    figure.scale.set(
      (edge.length * ROAD_EDGE_FILL) / ROAD_BAR_LENGTH,
      ROAD_WIDTH_SCALE,
      ROAD_WIDTH_SCALE,
    );
    const visibleIntent = !fly;
    this.placePiece(figure, visibleIntent, dto.seat);
    this.roads.set(dto.edgeId, { group: figure, seat: dto.seat, visibleIntent });
    return figure;
  }

  /**
   * Add a piece to the scene. A fly-in piece is parked hidden with no pop-in —
   * `revealPiece` plays the animation once the arsenal figure has landed.
   */
  private placePiece(figure: Group, visibleIntent: boolean, seat: PlayerSeat): void {
    this.trackGeometries(figure);
    this.group.add(figure);
    const effective = this.effectivePieceVisible(seat, visibleIntent);
    figure.visible = effective;
    if (effective && visibleIntent) {
      this.spawnBuildAnimation(figure);
    }
  }

  private effectivePieceVisible(seat: PlayerSeat, visibleIntent: boolean): boolean {
    return visibleIntent && !!this.lobbySeatMask[seat];
  }

  private spawnBuildAnimation(figure: Group): void {
    this.animations.push(
      new BuildAnimation({
        building: figure,
        dustHost: this.group,
        origin: new Vector3(figure.position.x, TILE_HEIGHT, figure.position.z),
      }),
    );
  }

  private materialsForSeat(seat: PlayerSeat): PlayerFigureMaterials {
    const normalizedSeat = BoardBuildings.normalizeSeat(seat);
    let materials = this.materialsBySeat.get(normalizedSeat);
    if (!materials) {
      const color = PLAYER_SEAT_ORDER[normalizedSeat] ?? PLAYER_SEAT_ORDER[0];
      materials = createFigureMaterials(color);
      this.materialsBySeat.set(normalizedSeat, materials);
    }
    return materials;
  }

  private static normalizeSeat(seat: PlayerSeat): PlayerSeat {
    const index = Number(seat);
    if (index >= PlayerSeat.North && index <= PlayerSeat.West) {
      return index as PlayerSeat;
    }
    return PlayerSeat.North;
  }

  private trackGeometries(figure: Group): void {
    figure.traverse((object) => {
      if (object instanceof Mesh) {
        this.trackedGeometries.push(object.geometry as BufferGeometry);
      }
    });
  }

  /**
   * Remove a placed figure from the scene and cancel any pop-in animation
   * still targeting it (so its dust cloud doesn't linger after the building
   * is gone). Caller is responsible for deleting the map entry.
   */
  private removePiece(figure: Group): void {
    for (let i = this.animations.length - 1; i >= 0; i -= 1) {
      if (this.animations[i].building === figure) {
        this.animations[i].dispose();
        this.animations.splice(i, 1);
      }
    }
    this.group.remove(figure);
    this.releaseGeometries(figure);
  }

  private releaseGeometries(figure: Group): void {
    figure.traverse((object) => {
      if (object instanceof Mesh) {
        const geometry = object.geometry as BufferGeometry;
        const index = this.trackedGeometries.indexOf(geometry);
        if (index >= 0) {
          this.trackedGeometries.splice(index, 1);
        }
        geometry.dispose();
      }
    });
  }
}
