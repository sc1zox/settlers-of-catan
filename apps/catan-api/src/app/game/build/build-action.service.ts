import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  GameDeltaType,
  GamePhase,
  type GameDeltaPayload,
} from '@catan/api-interfaces';
import { EconomyService } from '../economy/economy.service';
import { ResourceCostService } from '../economy/resource-cost.service';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { applyPostActionScoring } from '../utils/scoring.util';
import { TurnFlowService } from '../turn/turn-flow.service';

@Injectable()
export class BuildActionService {
  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly turnFlow: TurnFlowService,
    private readonly economy: EconomyService,
    private readonly resourceCost: ResourceCostService,
  ) {}

  public buildSettlement(
    lobby: LobbyRuntime,
    sessionToken: string,
    vertexId: string,
  ): GameDeltaPayload {
    this.validation.assertPhase(lobby, [
      GamePhase.SetupForward,
      GamePhase.SetupBackward,
      GamePhase.Building,
    ]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    const phase = lobby.fsm.getPhase();
    const isSetupPhase = phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward;
    if (isSetupPhase && lobby.pendingSetupRoadSeat !== null) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    this.validation.assertLegalSettlementVertex(lobby, player, vertexId, !isSetupPhase);
    if (phase === GamePhase.Building) {
      this.validation.assertSettlementCost(player);
      this.resourceCost.deductSettlementCost(player);
    }
    lobby.settlements.push({ seat: player.seat, vertexId, isCity: false });
    player.visibleVictoryPoints += 1;
    if (isSetupPhase) {
      if (phase === GamePhase.SetupBackward) {
        lobby.pendingSetupResourceSeat = player.seat;
        lobby.pendingSetupResourceFromVertexId = vertexId;
      }
      lobby.pendingSetupRoadSeat = player.seat;
      lobby.pendingSetupRoadFromVertexId = vertexId;
    }
    const delta: GameDeltaPayload = {
      type: GameDeltaType.SettlementBuilt,
      seat: player.seat,
      vertexId,
    };
    applyPostActionScoring(lobby);
    return delta;
  }

  public buildRoad(lobby: LobbyRuntime, sessionToken: string, edgeId: string): GameDeltaPayload {
    this.validation.assertPhase(lobby, [
      GamePhase.SetupForward,
      GamePhase.SetupBackward,
      GamePhase.Building,
    ]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    const phase = lobby.fsm.getPhase();
    const isSetupPhase = phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward;
    if (isSetupPhase) {
      if (
        lobby.pendingSetupRoadSeat !== player.seat ||
        lobby.pendingSetupRoadFromVertexId === null
      ) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
      this.validation.assertLegalRoadEdge(
        lobby,
        player,
        edgeId,
        lobby.pendingSetupRoadFromVertexId,
      );
    } else {
      this.validation.assertRoadCost(player);
      this.validation.assertLegalRoadEdge(lobby, player, edgeId);
      this.resourceCost.deductRoadCost(player);
    }
    lobby.roads.push({ seat: player.seat, edgeId });
    if (isSetupPhase) {
      if (
        phase === GamePhase.SetupBackward &&
        lobby.pendingSetupResourceSeat === player.seat &&
        lobby.pendingSetupResourceFromVertexId !== null
      ) {
        this.economy.grantSetupResourceFromSettlement(
          lobby,
          lobby.pendingSetupResourceSeat,
          lobby.pendingSetupResourceFromVertexId,
        );
        lobby.pendingSetupResourceSeat = null;
        lobby.pendingSetupResourceFromVertexId = null;
      }
      lobby.pendingSetupRoadSeat = null;
      lobby.pendingSetupRoadFromVertexId = null;
      if (phase === GamePhase.SetupForward) {
        this.turnFlow.applySetupForwardTransition(lobby, player.seat);
      } else {
        this.turnFlow.applySetupBackwardTransition(lobby, player.seat);
      }
    }
    const delta: GameDeltaPayload = {
      type: GameDeltaType.RoadBuilt,
      seat: player.seat,
      edgeId,
    };
    applyPostActionScoring(lobby);
    return delta;
  }

  public buildCity(lobby: LobbyRuntime, sessionToken: string, vertexId: string): void {
    this.validation.assertPhase(lobby, [GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    this.validation.assertCityCost(player);
    const settlement = lobby.settlements.find(
      (candidate) => candidate.vertexId === vertexId && candidate.seat === player.seat,
    );
    if (!settlement || settlement.isCity) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    this.resourceCost.deductCityCost(player);
    settlement.isCity = true;
    player.visibleVictoryPoints += 1;
    applyPostActionScoring(lobby);
  }
}
