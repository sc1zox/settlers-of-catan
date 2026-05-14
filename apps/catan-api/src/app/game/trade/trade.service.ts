import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TradeOfferDto, TradeStatus, type TradeProposePayload } from '@catan/api-interfaces';
import type { LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';

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

  /**
   * Mark every open offer for the given lobby as Rejected and return the
   * resulting list so the caller can broadcast a `TradeUpdated` per offer.
   * Called whenever the lobby leaves the Trading phase (finishTrading, or
   * any abnormal phase transition) so that reconnecting clients never see
   * an open offer that is no longer acceptable.
   */
  public expireOpenOffersForLobby(lobbyId: string): TradeOfferDto[] {
    const expired: TradeOfferDto[] = [];
    for (const [id, offer] of this.offers) {
      if (offer.lobbyId !== lobbyId || offer.status !== TradeStatus.Open) {
        continue;
      }
      const next: TradeOfferDto = { ...offer, status: TradeStatus.Rejected };
      this.offers.set(id, next);
      expired.push(next);
    }
    return expired;
  }
}
