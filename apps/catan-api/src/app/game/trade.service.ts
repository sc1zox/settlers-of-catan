import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TradeOfferDto, TradeStatus, type TradeProposePayload } from '@catan/api-interfaces';
import type { LobbyRuntime } from './lobby-runtime';
import type { LobbyPlayerSlot } from './lobby-runtime';

@Injectable()
export class TradeService {
  private readonly offers = new Map<string, TradeOfferDto>();

  public createOpenOffer(
    lobby: LobbyRuntime,
    from: LobbyPlayerSlot,
    payload: TradeProposePayload,
  ): TradeOfferDto {
    const id = randomUUID();
    const trade: TradeOfferDto = {
      id,
      lobbyId: payload.lobbyId,
      fromSeat: from.seat,
      toSeat: payload.toSeat,
      offer: { ...payload.offer },
      request: { ...payload.request },
      status: TradeStatus.Open,
    };
    this.offers.set(id, trade);
    return trade;
  }

  public getOffer(id: string): TradeOfferDto | undefined {
    return this.offers.get(id);
  }

  public setStatus(id: string, status: TradeStatus): TradeOfferDto | undefined {
    const existing = this.offers.get(id);
    if (!existing) {
      return undefined;
    }
    const next: TradeOfferDto = { ...existing, status };
    this.offers.set(id, next);
    return next;
  }
}
