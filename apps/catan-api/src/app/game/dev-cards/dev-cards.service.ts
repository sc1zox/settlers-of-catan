import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  assertResourceType,
  DevCardType,
  GamePhase,
  PlayerSeat,
  ResourceType,
} from '@catan/api-interfaces';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { applyRobberMove } from '../robber/robber.util';
import { ResourceCostService } from '../economy/resource-cost.service';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { assertRoadPieceAvailable } from '../utils/piece-bank.util';
import { applyPostActionScoring } from '../utils/scoring.util';
import {
  assertNoDevCardPlayedThisTurn,
  consumeRipenedDevCard,
  markDevCardPlayedThisTurn,
} from './dev-cards.runtime';

const PLAYABLE_PHASES: readonly GamePhase[] = [GamePhase.Trading, GamePhase.Building];

@Injectable()
export class DevCardsService {
  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly resourceCost: ResourceCostService,
  ) {}

  public buyDevCardAsCurrentTurn(lobby: LobbyRuntime, sessionToken: string): void {
    this.validation.assertPhase(lobby, [GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    if (lobby.devDeck.length === 0) {
      throw new Error(ActionRejectCode.NoDevCardAvailable);
    }
    this.validation.assertDevCardCost(player);
    this.resourceCost.deductDevCardCost(player);
    const topCard = lobby.devDeck.pop();
    if (!topCard) {
      throw new Error(ActionRejectCode.NoDevCardAvailable);
    }
    player.devCards.push(topCard);
    player.devCardsBoughtThisTurn.push(topCard);
    applyPostActionScoring(lobby);
  }

  public playKnightAsCurrentTurn(
    lobby: LobbyRuntime,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
  ): void {
    this.validation.assertPhase(lobby, PLAYABLE_PHASES);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    assertNoDevCardPlayedThisTurn(player);
    consumeRipenedDevCard(player, DevCardType.Knight);
    player.playedKnights += 1;
    applyRobberMove(lobby, player, q, r, victimSeat);
    markDevCardPlayedThisTurn(player);
    applyPostActionScoring(lobby);
  }

  public playMonopolyAsCurrentTurn(
    lobby: LobbyRuntime,
    sessionToken: string,
    resource: ResourceType,
  ): void {
    assertResourceType(resource);
    this.validation.assertPhase(lobby, PLAYABLE_PHASES);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    assertNoDevCardPlayedThisTurn(player);
    consumeRipenedDevCard(player, DevCardType.Monopoly);
    for (let i = 0; i < lobby.players.length; i += 1) {
      const other = lobby.players[i];
      if (other.seat === player.seat) {
        continue;
      }
      const amount = other.resources[resource] ?? 0;
      if (amount > 0) {
        other.resources[resource] = 0;
        player.resources[resource] = (player.resources[resource] ?? 0) + amount;
      }
    }
    markDevCardPlayedThisTurn(player);
    applyPostActionScoring(lobby);
  }

  public playYearOfPlentyAsCurrentTurn(
    lobby: LobbyRuntime,
    sessionToken: string,
    first: ResourceType,
    second: ResourceType,
  ): void {
    assertResourceType(first);
    assertResourceType(second);
    this.validation.assertPhase(lobby, PLAYABLE_PHASES);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    assertNoDevCardPlayedThisTurn(player);
    consumeRipenedDevCard(player, DevCardType.YearOfPlenty);
    player.resources[first] = (player.resources[first] ?? 0) + 1;
    player.resources[second] = (player.resources[second] ?? 0) + 1;
    markDevCardPlayedThisTurn(player);
    applyPostActionScoring(lobby);
  }

  public playRoadBuildingAsCurrentTurn(
    lobby: LobbyRuntime,
    sessionToken: string,
    firstEdgeId: string,
    secondEdgeId: string | undefined,
  ): void {
    this.validation.assertPhase(lobby, PLAYABLE_PHASES);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    assertNoDevCardPlayedThisTurn(player);
    consumeRipenedDevCard(player, DevCardType.RoadBuilding);
    this.validation.assertLegalRoadEdge(lobby, player, firstEdgeId);
    assertRoadPieceAvailable(lobby, player.seat);
    lobby.roads.push({ seat: player.seat, edgeId: firstEdgeId });
    if (secondEdgeId !== undefined && secondEdgeId.length > 0) {
      this.validation.assertLegalRoadEdge(lobby, player, secondEdgeId);
      assertRoadPieceAvailable(lobby, player.seat);
      lobby.roads.push({ seat: player.seat, edgeId: secondEdgeId });
    }
    markDevCardPlayedThisTurn(player);
    applyPostActionScoring(lobby);
  }
}
