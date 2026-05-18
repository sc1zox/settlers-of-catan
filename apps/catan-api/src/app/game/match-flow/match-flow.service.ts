import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  DiceRolledPayload,
  GamePhase,
  PlayerSeat,
  TradeStatus,
  TradeUpdateKind,
  TradeUpdatedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { EconomyService } from '../economy/economy.service';
import { resetTurnDevCardState } from '../dev-cards/dev-cards.runtime';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { TradeService } from '../trade/trade.service';
import { emitTradeUpdatedToInvolvedSockets } from '../trade/trade-emit.util';
import { getMinimumPlayerCountToStartLobby } from './match-start-rules';
import { TurnFlowService } from '../turn/turn-flow.service';

@Injectable()
export class MatchFlowService {
  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly tradeService: TradeService,
    private readonly turnFlow: TurnFlowService,
    private readonly economy: EconomyService,
  ) {}

  public startLobby(lobby: LobbyRuntime, sessionToken: string): void {
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (lobby.adminSessionToken !== sessionToken) {
      throw new Error(ActionRejectCode.LobbyHostOnly);
    }
    const activeSeats = this.turnFlow.getActiveTurnSeats(lobby);
    const minimumPlayerCount = getMinimumPlayerCountToStartLobby(lobby);
    if (activeSeats.length < minimumPlayerCount) {
      throw new Error(ActionRejectCode.LobbyNotEnoughPlayers);
    }
    lobby.fsm.onLobbyStarted();
    lobby.currentSeat = this.turnFlow.firstTurnSeat(lobby);
  }

  public rollDice(lobby: LobbyRuntime, sessionToken: string, lobbyId: string): DiceRolledPayload {
    this.validation.assertPhase(lobby, [GamePhase.Rolling]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    const roll = this.economy.createDiceRoll();
    lobby.lastDiceRoll = roll;
    return {
      lobbyId,
      rollerSeat: player.seat,
      roll,
    };
  }

  public endTurn(lobby: LobbyRuntime, sessionToken: string): void {
    this.validation.assertPhase(lobby, [GamePhase.Building]);
    this.validation.assertCurrentPlayer(lobby, sessionToken);
    lobby.currentSeat = this.turnFlow.nextSeat(lobby, lobby.currentSeat);
    lobby.lastDiceRoll = null;
    lobby.pendingRobberDiscardSeats = [];
    resetTurnDevCardState(lobby);
    lobby.fsm.onTurnEnded();
  }

  public completeTradingPhaseAndExpireOffers(
    lobby: LobbyRuntime,
    sessionToken: string,
    lobbyId: string,
    server: Server,
  ): void {
    const actorSeat = this.assertMayCompleteTradingPhase(lobby, sessionToken);
    this.transitionFromTradingToBuilding(lobby);
    this.emitExpiredTradeOffers(lobby, lobbyId, actorSeat, server);
  }

  private assertMayCompleteTradingPhase(
    lobby: LobbyRuntime,
    sessionToken: string,
  ): PlayerSeat {
    this.validation.assertPhase(lobby, [GamePhase.Trading]);
    return this.validation.assertCurrentPlayer(lobby, sessionToken).seat;
  }

  private transitionFromTradingToBuilding(lobby: LobbyRuntime): void {
    lobby.fsm.onTradingFinished();
  }

  private emitExpiredTradeOffers(
    lobby: LobbyRuntime,
    lobbyId: string,
    actorSeat: PlayerSeat,
    server: Server,
  ): void {
    const expired = this.tradeService.closeOpenOffersForLobby(lobbyId, TradeStatus.Rejected);
    for (let i = 0; i < expired.length; i += 1) {
      const payload: TradeUpdatedPayload = {
        lobbyId,
        trade: expired[i],
        kind: TradeUpdateKind.PhaseClosed,
        actorSeat,
      };
      emitTradeUpdatedToInvolvedSockets(server, lobby, payload);
    }
  }
}
