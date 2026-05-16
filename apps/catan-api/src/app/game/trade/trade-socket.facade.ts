import { Injectable } from '@nestjs/common';
import {
  BankTradePayload,
  FinishTradingPayload,
  TradeAcceptPayload,
  TradeProposePayload,
  TradeRejectPayload,
  formatSocketIoLobbyRoomId,
  GameSocketServerEvent,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { GameService } from '../core/game.service';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import type { LobbyRuntime } from '../lobby/lobby-runtime';
import { TradeActionsService } from './trade-actions.service';

@Injectable()
export class TradeSocketFacade {
  public constructor(
    private readonly gameService: GameService,
    private readonly tradeActions: TradeActionsService,
    private readonly demoBots: DemoBotService,
  ) {}

  public bankTrade(server: Server, payload: BankTradePayload, sessionToken: string): void {
    this.gameService.bankTrade(
      payload.lobbyId,
      sessionToken,
      payload.giveResource,
      payload.giveAmount,
      payload.receiveResource,
      server,
    );
  }

  public finishTrading(server: Server, payload: FinishTradingPayload, sessionToken: string): void {
    this.gameService.finishTrading(payload.lobbyId, sessionToken, server);
  }

  public proposeTrade(server: Server, payload: TradeProposePayload, sessionToken: string): void {
    const body = this.tradeActions.proposeTrade(this.tradeActionContext(server), sessionToken, payload);
    const roomId = formatSocketIoLobbyRoomId(body.lobbyId);
    server.to(roomId).emit(GameSocketServerEvent.TradeUpdated, body);
    const botSession = this.demoBots.resolveDemoBotTradeAcceptorSessionToken(
      this.gameService.getLobby(payload.lobbyId),
      body.trade.toSeat,
    );
    if (botSession !== null) {
      const ctx = this.tradeActionContext(server);
      try {
        const accepted = this.tradeActions.acceptTrade(ctx, botSession, {
          lobbyId: payload.lobbyId,
          tradeId: body.trade.id,
        });
        if (accepted.tradeUpdated !== null) {
          server.to(roomId).emit(GameSocketServerEvent.TradeUpdated, accepted.tradeUpdated);
        }
      } catch {
        const rejected = this.tradeActions.rejectTrade(ctx, botSession, {
          lobbyId: payload.lobbyId,
          tradeId: body.trade.id,
        });
        if (rejected.tradeUpdated !== null) {
          server.to(roomId).emit(GameSocketServerEvent.TradeUpdated, rejected.tradeUpdated);
        }
      }
    }
  }

  public acceptTrade(server: Server, payload: TradeAcceptPayload, sessionToken: string): void {
    const result = this.tradeActions.acceptTrade(this.tradeActionContext(server), sessionToken, payload);
    if (result.tradeUpdated !== null) {
      server
        .to(formatSocketIoLobbyRoomId(result.lobbyId))
        .emit(GameSocketServerEvent.TradeUpdated, result.tradeUpdated);
    }
  }

  public rejectTrade(server: Server, payload: TradeRejectPayload, sessionToken: string): void {
    const result = this.tradeActions.rejectTrade(this.tradeActionContext(server), sessionToken, payload);
    if (result.tradeUpdated !== null) {
      server
        .to(formatSocketIoLobbyRoomId(result.lobbyId))
        .emit(GameSocketServerEvent.TradeUpdated, result.tradeUpdated);
    }
  }

  private tradeActionContext(server: Server): {
    getLobby: (lobbyId: string) => LobbyRuntime | undefined;
    broadcastLobby: (lobby: LobbyRuntime) => void;
  } {
    return {
      getLobby: (lobbyId: string) => this.gameService.getLobby(lobbyId),
      broadcastLobby: (lobby: LobbyRuntime) => this.gameService.broadcastFullState(server, lobby),
    };
  }
}
