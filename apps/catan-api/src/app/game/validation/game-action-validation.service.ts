import { Injectable } from '@nestjs/common';
import { ActionRejectCode, GamePhase, PlayerSeat, ResourceType } from '@catan/api-interfaces';
import type { LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';
import {
  CITY_COST,
  DEV_CARD_COST,
  ROAD_COST,
  SETTLEMENT_COST,
} from '../economy/build-resource-costs';

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

  public computeLegalMoves(
    lobby: LobbyRuntime,
    seat: PlayerSeat,
  ): { settlements: string[]; roads: string[]; cities: string[]; roadBuilding: string[] } {
    const settlements: string[] = [];
    const roads: string[] = [];
    const cities: string[] = [];
    const roadBuilding: string[] = [];
    const player = lobby.findPlayerBySeat(seat);
    if (!player || lobby.currentSeat !== seat) {
      return { settlements, roads, cities, roadBuilding };
    }
    const phase = lobby.fsm.getPhase();

    if (phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward) {
      const pendingVertexId =
        lobby.pendingSetupRoadSeat === seat ? lobby.pendingSetupRoadFromVertexId : null;
      if (pendingVertexId !== null) {
        for (const edgeId of lobby.edgesById.keys()) {
          if (
            this.isPlacementLegal(() =>
              this.assertLegalRoadEdge(lobby, player, edgeId, pendingVertexId),
            )
          ) {
            roads.push(edgeId);
          }
        }
      } else {
        for (const vertexId of lobby.verticesById.keys()) {
          if (
            this.isPlacementLegal(() =>
              this.assertLegalSettlementVertex(lobby, player, vertexId, false),
            )
          ) {
            settlements.push(vertexId);
          }
        }
      }
      return { settlements, roads, cities, roadBuilding };
    }

    if (phase === GamePhase.Building) {
      if (this.isPlacementLegal(() => this.assertSettlementCost(player))) {
        for (const vertexId of lobby.verticesById.keys()) {
          if (
            this.isPlacementLegal(() =>
              this.assertLegalSettlementVertex(lobby, player, vertexId, true),
            )
          ) {
            settlements.push(vertexId);
          }
        }
      }
      if (this.isPlacementLegal(() => this.assertRoadCost(player))) {
        for (const edgeId of lobby.edgesById.keys()) {
          if (this.isPlacementLegal(() => this.assertLegalRoadEdge(lobby, player, edgeId))) {
            roads.push(edgeId);
          }
        }
      }
      if (this.isPlacementLegal(() => this.assertCityCost(player))) {
        for (let i = 0; i < lobby.settlements.length; i += 1) {
          const settlement = lobby.settlements[i];
          if (settlement.seat === seat && !settlement.isCity) {
            cities.push(settlement.vertexId);
          }
        }
      }
    }

    if (phase === GamePhase.Trading || phase === GamePhase.Building) {
      for (const edgeId of lobby.edgesById.keys()) {
        if (this.isPlacementLegal(() => this.assertLegalRoadEdge(lobby, player, edgeId))) {
          roadBuilding.push(edgeId);
        }
      }
    }

    return { settlements, roads, cities, roadBuilding };
  }

  private isPlacementLegal(assertion: () => void): boolean {
    try {
      assertion();
      return true;
    } catch {
      return false;
    }
  }
}
