import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  BankTradePayload,
  FinishTradingPayload,
  TradeAcceptPayload,
  TradeCounterPayload,
  TradeFinalizePayload,
  TradeProposePayload,
  TradeRejectPayload,
  TradeWithdrawCounterPayload,
} from '@catan/api-interfaces';
import { TradeGatewayService } from '../trade/trade-gateway.service';
import { GatewaySocketSessionService } from './gateway-common.services';

@Injectable()
export class GatewayTradeHandlers {
  public constructor(
    private readonly sessions: GatewaySocketSessionService,
    private readonly tradeSocket: TradeGatewayService,
  ) {}

  public bankTrade(server: Server, client: Socket, payload: BankTradePayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.bankTrade(server, payload, sessionToken);
  }

  public finishTrading(server: Server, client: Socket, payload: FinishTradingPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.finishTrading(server, payload, sessionToken);
  }

  public tradePropose(server: Server, client: Socket, payload: TradeProposePayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.proposeTrade(server, payload, sessionToken);
  }

  public tradeAccept(server: Server, client: Socket, payload: TradeAcceptPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.acceptTrade(server, payload, sessionToken);
  }

  public tradeReject(server: Server, client: Socket, payload: TradeRejectPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.rejectTrade(server, payload, sessionToken);
  }

  public tradeCounter(server: Server, client: Socket, payload: TradeCounterPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.counterTrade(server, payload, sessionToken);
  }

  public tradeWithdrawCounter(
    server: Server,
    client: Socket,
    payload: TradeWithdrawCounterPayload,
  ): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.withdrawCounterTrade(server, payload, sessionToken);
  }

  public tradeFinalize(server: Server, client: Socket, payload: TradeFinalizePayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.tradeSocket.finalizeTrade(server, payload, sessionToken);
  }
}
