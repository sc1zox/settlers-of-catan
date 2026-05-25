import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  GamePhase,
  PieceBankLimit,
  PlayerSeat,
  ResourceType,
} from '@catan/api-interfaces';
import type { LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';
import {
  CITY_COST,
  DEV_CARD_COST,
  ROAD_COST,
  SETTLEMENT_COST,
} from '../economy/build-resource-costs';
import {
  countCitiesForSeat,
  countRoadsForSeat,
  countSettlementsForSeat,
} from '../utils/piece-bank.util';

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

  public canAffordSettlementCost(player: LobbyPlayerSlot): boolean {
    const keys = Object.keys(SETTLEMENT_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i++) {
      const r = keys[i];
      if ((player.resources[r] ?? 0) < (SETTLEMENT_COST[r] ?? 0)) {
        return false;
      }
    }
    return true;
  }

  public assertSettlementCost(player: LobbyPlayerSlot): void {
    if (!this.canAffordSettlementCost(player)) {
      throw new Error(ActionRejectCode.InsufficientResources);
    }
  }

  public canPlaceSettlementAtVertex(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    vertexId: string,
    requireOwnRoad: boolean,
  ): boolean {
    const vertex = lobby.verticesById.get(vertexId);
    if (!vertex) {
      return false;
    }
    for (let i = 0; i < lobby.settlements.length; i += 1) {
      if (lobby.settlements[i].vertexId === vertexId) {
        return false;
      }
    }
    for (let i = 0; i < vertex.neighborVertexIds.length; i += 1) {
      if (this.hasSettlementOnVertex(lobby, vertex.neighborVertexIds[i])) {
        return false;
      }
    }
    if (!requireOwnRoad) {
      return true;
    }
    for (let i = 0; i < vertex.edgeIds.length; i += 1) {
      if (this.hasRoadOnEdgeBySeat(lobby, vertex.edgeIds[i], player.seat)) {
        return true;
      }
    }
    return false;
  }

  public assertLegalSettlementVertex(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    vertexId: string,
    requireOwnRoad: boolean,
  ): void {
    if (!this.canPlaceSettlementAtVertex(lobby, player, vertexId, requireOwnRoad)) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
  }

  public canAffordRoadCost(player: LobbyPlayerSlot): boolean {
    const keys = Object.keys(ROAD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      if ((player.resources[keys[i]] ?? 0) < (ROAD_COST[keys[i]] ?? 0)) {
        return false;
      }
    }
    return true;
  }

  public assertRoadCost(player: LobbyPlayerSlot): void {
    if (!this.canAffordRoadCost(player)) {
      throw new Error(ActionRejectCode.InsufficientResources);
    }
  }

  public canAffordCityCost(player: LobbyPlayerSlot): boolean {
    const keys = Object.keys(CITY_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      if ((player.resources[keys[i]] ?? 0) < (CITY_COST[keys[i]] ?? 0)) {
        return false;
      }
    }
    return true;
  }

  public assertCityCost(player: LobbyPlayerSlot): void {
    if (!this.canAffordCityCost(player)) {
      throw new Error(ActionRejectCode.InsufficientResources);
    }
  }

  public assertDevCardCost(player: LobbyPlayerSlot): void {
    if (!this.canAffordDevCardCost(player)) {
      throw new Error(ActionRejectCode.InsufficientResources);
    }
  }

  public canAffordDevCardCost(player: LobbyPlayerSlot): boolean {
    const keys = Object.keys(DEV_CARD_COST) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const resource = keys[i];
      const need = DEV_CARD_COST[resource] ?? 0;
      if ((player.resources[resource] ?? 0) < need) {
        return false;
      }
    }
    return true;
  }

  public canPlaceRoadAtEdge(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    edgeId: string,
    requiredVertexId?: string,
  ): boolean {
    const edge = lobby.edgesById.get(edgeId);
    if (!edge) {
      return false;
    }
    for (let i = 0; i < lobby.roads.length; i += 1) {
      if (lobby.roads[i].edgeId === edgeId) {
        return false;
      }
    }
    if (requiredVertexId !== undefined) {
      return edge.aVertexId === requiredVertexId || edge.bVertexId === requiredVertexId;
    }
    return (
      this.canConnectRoadAtVertex(lobby, player, edge.aVertexId) ||
      this.canConnectRoadAtVertex(lobby, player, edge.bVertexId)
    );
  }

  public assertLegalRoadEdge(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    edgeId: string,
    requiredVertexId?: string,
  ): void {
    if (!this.canPlaceRoadAtEdge(lobby, player, edgeId, requiredVertexId)) {
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
          if (this.canPlaceRoadAtEdge(lobby, player, edgeId, pendingVertexId)) {
            roads.push(edgeId);
          }
        }
      } else {
        for (const vertexId of lobby.verticesById.keys()) {
          if (this.canPlaceSettlementAtVertex(lobby, player, vertexId, false)) {
            settlements.push(vertexId);
          }
        }
      }
      return { settlements, roads, cities, roadBuilding };
    }

    if (phase === GamePhase.Building) {
      if (
        this.canAffordSettlementCost(player) &&
        countSettlementsForSeat(lobby, seat) < PieceBankLimit.SettlementsPerPlayer
      ) {
        for (const vertexId of lobby.verticesById.keys()) {
          if (this.canPlaceSettlementAtVertex(lobby, player, vertexId, true)) {
            settlements.push(vertexId);
          }
        }
      }
      if (
        this.canAffordRoadCost(player) &&
        countRoadsForSeat(lobby, seat) < PieceBankLimit.RoadsPerPlayer
      ) {
        for (const edgeId of lobby.edgesById.keys()) {
          if (this.canPlaceRoadAtEdge(lobby, player, edgeId)) {
            roads.push(edgeId);
          }
        }
      }
      if (
        this.canAffordCityCost(player) &&
        countCitiesForSeat(lobby, seat) < PieceBankLimit.CitiesPerPlayer
      ) {
        for (let i = 0; i < lobby.settlements.length; i += 1) {
          const settlement = lobby.settlements[i];
          if (settlement.seat === seat && !settlement.isCity) {
            cities.push(settlement.vertexId);
          }
        }
      }
    }

    if (
      (phase === GamePhase.Trading || phase === GamePhase.Building) &&
      countRoadsForSeat(lobby, seat) < PieceBankLimit.RoadsPerPlayer
    ) {
      for (const edgeId of lobby.edgesById.keys()) {
        if (this.canPlaceRoadAtEdge(lobby, player, edgeId)) {
          roadBuilding.push(edgeId);
        }
      }
    }

    return { settlements, roads, cities, roadBuilding };
  }
}
