import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  DevCardType,
  GamePhase,
  PlayerSeat,
  ResourceType,
} from '@catan/api-interfaces';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import type { LobbyPlayerSlot } from '../lobby/lobby-runtime';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { applyRobberMove } from './robber.util';
import { applyPostActionScoring, consumeDevCard } from '../utils/scoring.util';

@Injectable()
export class RobberService {
  public constructor(private readonly validation: GameActionValidationService) {}

  public collectRobberDiscardSeats(lobby: LobbyRuntime): PlayerSeat[] {
    const seats: PlayerSeat[] = [];
    for (let i = 0; i < lobby.players.length; i += 1) {
      const player = lobby.players[i];
      if (lobby.requiredRobberDiscardCount(player) > 0) {
        seats.push(player.seat);
      }
    }
    return seats;
  }

  public submitRobberDiscard(
    lobby: LobbyRuntime,
    sessionToken: string,
    discard: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    this.validation.assertPhase(lobby, [GamePhase.RobberDiscard]);
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (!lobby.pendingRobberDiscardSeats.includes(player.seat)) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    const expected = lobby.requiredRobberDiscardCount(player);
    let actual = 0;
    const resourceKeys = Object.values(ResourceType);
    for (let i = 0; i < resourceKeys.length; i += 1) {
      const resource = resourceKeys[i];
      const amount = discard[resource] ?? 0;
      if (amount < 0 || !Number.isInteger(amount)) {
        throw new Error(ActionRejectCode.IllegalPlacement);
      }
      if ((player.resources[resource] ?? 0) < amount) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
      actual += amount;
    }
    if (actual !== expected) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
    for (let i = 0; i < resourceKeys.length; i += 1) {
      const resource = resourceKeys[i];
      const amount = discard[resource] ?? 0;
      if (amount > 0) {
        player.resources[resource] = (player.resources[resource] ?? 0) - amount;
      }
    }
    lobby.pendingRobberDiscardSeats = lobby.pendingRobberDiscardSeats.filter(
      (seat) => seat !== player.seat,
    );
    if (lobby.pendingRobberDiscardSeats.length === 0) {
      lobby.fsm.onDiscardRoundResolved();
    }
  }

  public moveRobber(
    lobby: LobbyRuntime,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
  ): void {
    this.validation.assertPhase(lobby, [GamePhase.RobberMove]);
    const actor = this.validation.assertCurrentPlayer(lobby, sessionToken);
    applyRobberMove(lobby, actor, q, r, victimSeat);
    lobby.fsm.onRobberMoved();
  }

  public playKnightDevCard(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
  ): void {
    if (!consumeDevCard(player, DevCardType.Knight)) {
      throw new Error(ActionRejectCode.DevCardNotOwned);
    }
    player.playedKnights += 1;
    applyRobberMove(lobby, player, q, r, victimSeat);
    applyPostActionScoring(lobby);
  }

  public playKnightDevCardAsCurrentTurn(
    lobby: LobbyRuntime,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
  ): void {
    this.validation.assertPhase(lobby, [GamePhase.Trading, GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    this.playKnightDevCard(lobby, player, q, r, victimSeat);
  }
}
