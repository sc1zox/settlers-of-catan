import { Injectable } from '@nestjs/common';
import { ActionRejectCode, GamePhase, ResourceType } from '@catan/api-interfaces';
import type { LobbyPlayerSlot, LobbyRuntime } from './lobby-runtime';

const SETTLEMENT_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wood]: 1,
  [ResourceType.Brick]: 1,
  [ResourceType.Wheat]: 1,
  [ResourceType.Wool]: 1,
};

const ROAD_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wood]: 1,
  [ResourceType.Brick]: 1,
};

const CITY_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wheat]: 2,
  [ResourceType.Ore]: 3,
};

const DEV_CARD_COST: Readonly<Partial<Record<ResourceType, number>>> = {
  [ResourceType.Wheat]: 1,
  [ResourceType.Wool]: 1,
  [ResourceType.Ore]: 1,
};

@Injectable()
export class GameActionValidationService {
  public assertCurrentPlayer(lobby: LobbyRuntime, sessionToken: string): LobbyPlayerSlot {
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (player.seat !== lobby.currentSeat) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    return player;
  }

  public assertPhase(lobby: LobbyRuntime, allowed: readonly GamePhase[]): void {
    lobby.fsm.assertOneOf(allowed);
  }

  public assertSettlementCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(SETTLEMENT_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i++) {
      const r = keys[i];
      const need = SETTLEMENT_COST[r] ?? 0;
      if ((player.resources[r] ?? 0) < need) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
    }
  }

  public assertLegalSettlementVertex(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    vertexId: string,
    requireOwnRoad: boolean,
  ): void {
    const vertex = lobby.verticesById.get(vertexId);
    if (!vertex) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    for (let i = 0; i < lobby.settlements.length; i += 1) {
      const settlement = lobby.settlements[i];
      if (settlement.vertexId === vertexId) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
    }
    for (let i = 0; i < vertex.neighborVertexIds.length; i += 1) {
      const neighborVertexId = vertex.neighborVertexIds[i];
      if (this.hasSettlementOnVertex(lobby, neighborVertexId)) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
    }
    if (!requireOwnRoad) {
      return;
    }
    let hasConnectedRoad = false;
    for (let i = 0; i < vertex.edgeIds.length; i += 1) {
      const edgeId = vertex.edgeIds[i];
      if (this.hasRoadOnEdgeBySeat(lobby, edgeId, player.seat)) {
        hasConnectedRoad = true;
        break;
      }
    }
    if (!hasConnectedRoad) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
  }

  public assertRoadCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(ROAD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = ROAD_COST[resource] ?? 0;
      if ((player.resources[resource] ?? 0) < need) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
    }
  }

  public assertCityCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(CITY_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = CITY_COST[resource] ?? 0;
      if ((player.resources[resource] ?? 0) < need) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
    }
  }

  public deductCityCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(CITY_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = CITY_COST[resource] ?? 0;
      player.resources[resource] = (player.resources[resource] ?? 0) - need;
    }
  }

  public assertDevCardCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(DEV_CARD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = DEV_CARD_COST[resource] ?? 0;
      if ((player.resources[resource] ?? 0) < need) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
    }
  }

  public deductDevCardCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(DEV_CARD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = DEV_CARD_COST[resource] ?? 0;
      player.resources[resource] = (player.resources[resource] ?? 0) - need;
    }
  }

  public deductRoadCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(ROAD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = ROAD_COST[resource] ?? 0;
      player.resources[resource] = (player.resources[resource] ?? 0) - need;
    }
  }

  public assertLegalRoadEdge(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    edgeId: string,
    requiredVertexId?: string,
  ): void {
    const edge = lobby.edgesById.get(edgeId);
    if (!edge) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    for (let i = 0; i < lobby.roads.length; i += 1) {
      const road = lobby.roads[i];
      if (road.edgeId === edgeId) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
    }
    if (requiredVertexId !== undefined) {
      if (edge.aVertexId !== requiredVertexId && edge.bVertexId !== requiredVertexId) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
      return;
    }
    const canConnectFromA = this.canConnectRoadAtVertex(lobby, player, edge.aVertexId);
    const canConnectFromB = this.canConnectRoadAtVertex(lobby, player, edge.bVertexId);
    if (!canConnectFromA && !canConnectFromB) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
  }

  private canConnectRoadAtVertex(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    vertexId: string,
  ): boolean {
    const settlementOwnerSeat = this.getSettlementOwnerSeatAtVertex(lobby, vertexId);
    if (settlementOwnerSeat !== null && settlementOwnerSeat !== player.seat) {
      return false;
    }
    if (settlementOwnerSeat === player.seat) {
      return true;
    }
    const vertex = lobby.verticesById.get(vertexId);
    if (!vertex) {
      return false;
    }
    for (let i = 0; i < vertex.edgeIds.length; i += 1) {
      const candidateEdgeId = vertex.edgeIds[i];
      if (this.hasRoadOnEdgeBySeat(lobby, candidateEdgeId, player.seat)) {
        return true;
      }
    }
    return false;
  }

  private getSettlementOwnerSeatAtVertex(
    lobby: LobbyRuntime,
    vertexId: string,
  ): LobbyPlayerSlot['seat'] | null {
    for (let i = 0; i < lobby.settlements.length; i += 1) {
      const settlement = lobby.settlements[i];
      if (settlement.vertexId === vertexId) {
        return settlement.seat;
      }
    }
    return null;
  }

  private hasSettlementOnVertex(lobby: LobbyRuntime, vertexId: string): boolean {
    for (let i = 0; i < lobby.settlements.length; i += 1) {
      if (lobby.settlements[i].vertexId === vertexId) {
        return true;
      }
    }
    return false;
  }

  private hasRoadOnEdgeBySeat(
    lobby: LobbyRuntime,
    edgeId: string,
    seat: LobbyPlayerSlot['seat'],
  ): boolean {
    for (let i = 0; i < lobby.roads.length; i += 1) {
      const road = lobby.roads[i];
      if (road.edgeId === edgeId && road.seat === seat) {
        return true;
      }
    }
    return false;
  }

  public deductSettlementCost(player: LobbyPlayerSlot): void {
    const keys = Object.keys(SETTLEMENT_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i++) {
      const r = keys[i];
      const need = SETTLEMENT_COST[r] ?? 0;
      player.resources[r] = (player.resources[r] ?? 0) - need;
    }
  }
}
