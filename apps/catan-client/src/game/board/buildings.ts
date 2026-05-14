import { BufferGeometry, Group, Mesh, Vector3 } from 'three';
import type {
  LobbyRoadDto,
  LobbySettlementDto,
  PlayerSeat,
} from '@catan/api-interfaces';
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
}

/**
 * Server-authoritative board overlay: renders settlements, cities and roads at
 * their vertex / edge world positions and plays a construction animation each
 * time a new piece appears in the lobby state. Owned by `GameEngine`; updated
 * every frame and disposed with the engine.
 */
export class BoardBuildings {
  readonly group: Group = new Group();

  private readonly settlements = new Map<string, PlacedSettlement>();
  private readonly roads = new Map<string, Group>();
  private readonly animations: BuildAnimation[] = [];
  private readonly materialsBySeat = new Map<PlayerSeat, PlayerFigureMaterials>();
  private readonly trackedGeometries: BufferGeometry[] = [];

  /** Diff the lobby state against what is rendered; spawn animations for new pieces. */
  syncToState(
    settlements: readonly LobbySettlementDto[],
    roads: readonly LobbyRoadDto[],
  ): void {
    for (let i = 0; i < settlements.length; i += 1) {
      const dto = settlements[i];
      const existing = this.settlements.get(dto.vertexId);
      if (!existing) {
        this.spawnSettlement(dto);
      } else if (dto.isCity && !existing.isCity) {
        this.upgradeToCity(dto, existing);
      }
    }
    for (let i = 0; i < roads.length; i += 1) {
      const dto = roads[i];
      if (!this.roads.has(dto.edgeId)) {
        this.spawnRoad(dto);
      }
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

  dispose(): void {
    for (let i = 0; i < this.animations.length; i += 1) {
      this.animations[i].dispose();
    }
    this.animations.length = 0;
    for (let i = 0; i < this.trackedGeometries.length; i += 1) {
      this.trackedGeometries[i].dispose();
    }
    this.trackedGeometries.length = 0;
    for (const materials of this.materialsBySeat.values()) {
      disposeFigureMaterials(materials);
    }
    this.materialsBySeat.clear();
    this.settlements.clear();
    this.roads.clear();
    this.group.clear();
  }

  private spawnSettlement(dto: LobbySettlementDto): void {
    const figure = makeSettlement(this.materialsForSeat(dto.seat));
    const world = vertexIdToWorld(dto.vertexId);
    figure.position.set(world.x, TILE_HEIGHT, world.z);
    figure.scale.setScalar(SETTLEMENT_SCALE);
    this.placePiece(figure, world);
    this.settlements.set(dto.vertexId, { group: figure, isCity: false });
  }

  private upgradeToCity(dto: LobbySettlementDto, existing: PlacedSettlement): void {
    this.group.remove(existing.group);
    this.releaseGeometries(existing.group);
    const figure = makeCity(this.materialsForSeat(dto.seat));
    const world = vertexIdToWorld(dto.vertexId);
    figure.position.set(world.x, TILE_HEIGHT, world.z);
    figure.scale.setScalar(CITY_SCALE);
    this.placePiece(figure, world);
    this.settlements.set(dto.vertexId, { group: figure, isCity: true });
  }

  private spawnRoad(dto: LobbyRoadDto): void {
    const figure = makeRoad(this.materialsForSeat(dto.seat));
    const edge = edgeIdToWorld(dto.edgeId);
    figure.position.set(edge.position.x, TILE_HEIGHT, edge.position.z);
    figure.rotation.y = edge.angle;
    figure.scale.set(
      (edge.length * ROAD_EDGE_FILL) / ROAD_BAR_LENGTH,
      ROAD_WIDTH_SCALE,
      ROAD_WIDTH_SCALE,
    );
    this.placePiece(figure, edge.position);
    this.roads.set(dto.edgeId, figure);
  }

  private placePiece(figure: Group, originXZ: Vector3): void {
    this.trackGeometries(figure);
    this.group.add(figure);
    this.animations.push(
      new BuildAnimation({
        building: figure,
        dustHost: this.group,
        origin: new Vector3(originXZ.x, TILE_HEIGHT, originXZ.z),
      }),
    );
  }

  private materialsForSeat(seat: PlayerSeat): PlayerFigureMaterials {
    let materials = this.materialsBySeat.get(seat);
    if (!materials) {
      const color = PLAYER_SEAT_ORDER[seat] ?? PLAYER_SEAT_ORDER[0];
      materials = createFigureMaterials(color);
      this.materialsBySeat.set(seat, materials);
    }
    return materials;
  }

  private trackGeometries(figure: Group): void {
    figure.traverse((object) => {
      if (object instanceof Mesh) {
        this.trackedGeometries.push(object.geometry as BufferGeometry);
      }
    });
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
