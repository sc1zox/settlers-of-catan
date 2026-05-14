import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  DiceRolledPayload,
  GamePhase,
  GameSocketServerEvent,
  TradeUpdatedPayload,
  formatSocketIoLobbyRoomId,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { DemoBotService } from './demo-bot.service';
import { EconomyService } from './economy.service';
import { GameActionValidationService } from './game-action-validation.service';
import { LobbyRuntime } from './lobby-runtime';
import { TradeService } from './trade.service';
import { TurnFlowService } from './turn-flow.service';

@Injectable()
export class MatchFlowService {
  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly tradeService: TradeService,
    private readonly turnFlow: TurnFlowService,
    private readonly economy: EconomyService,
    private readonly demoBots: DemoBotService,
  ) {}

  public startLobby(lobby: LobbyRuntime, sessionToken: string): void {
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (lobby.adminSessionToken !== sessionToken) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const activeSeats = this.turnFlow.getActiveTurnSeats(lobby);
    const minimumPlayerCount = this.demoBots.getMinimumStartPlayerCount(lobby);
    if (activeSeats.length < minimumPlayerCount) {
      throw new Error(ActionRejectCode.IllegalPlacement);
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
    lobby.fsm.onTurnEnded();
  }

  public finishTrading(lobby: LobbyRuntime, sessionToken: string, lobbyId: string, server: Server): void {
    this.validation.assertPhase(lobby, [GamePhase.Trading]);
    this.validation.assertCurrentPlayer(lobby, sessionToken);
    lobby.fsm.onTradingFinished();
    this.emitExpiredTradeOffers(lobbyId, server);
  }

  private emitExpiredTradeOffers(lobbyId: string, server: Server): void {
    const expired = this.tradeService.expireOpenOffersForLobby(lobbyId);
    if (expired.length === 0) {
      return;
    }
    const room = formatSocketIoLobbyRoomId(lobbyId);
    for (let i = 0; i < expired.length; i += 1) {
      const payload: TradeUpdatedPayload = { lobbyId, trade: expired[i] };
      server.to(room).emit(GameSocketServerEvent.TradeUpdated, payload);
    }
  }
}
