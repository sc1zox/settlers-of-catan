import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  PlayerSeat,
  ResourceType,
  TradeOfferDto,
  TradeRecipientResponse,
  TradeRecipientStatus,
  TradeStatus,
} from '@catan/api-interfaces';
import type { LobbyRuntime } from '../lobby/lobby-runtime';

@Injectable()
export class TradeService {
  private readonly offers = new Map<string, TradeOfferDto>();

  public createOpenOffer(
    lobby: LobbyRuntime,
    fromSeat: PlayerSeat,
    recipients: readonly PlayerSeat[],
    offer: Readonly<Partial<Record<ResourceType, number>>>,
    request: Readonly<Partial<Record<ResourceType, number>>>,
  ): TradeOfferDto {
    const id = randomUUID();
    const recipientSlots: TradeRecipientResponse[] = recipients.map((seat) => ({
      seat,
      status: TradeRecipientStatus.Pending,
    }));
    const trade: TradeOfferDto = {
      id,
      lobbyId: lobby.lobbyId,
      fromSeat,
      offer: { ...offer },
      request: { ...request },
      recipients: recipientSlots,
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

  /** Replace one recipient slot, return the updated trade. */
  public updateRecipient(
    id: string,
    seat: PlayerSeat,
    patch: Partial<Omit<TradeRecipientResponse, 'seat'>>,
  ): TradeOfferDto | undefined {
    const existing = this.offers.get(id);
    if (!existing) {
      return undefined;
    }
    const recipients = existing.recipients.map((slot) =>
      slot.seat === seat ? { ...slot, ...patch } : slot,
    );
    const next: TradeOfferDto = { ...existing, recipients };
    this.offers.set(id, next);
    return next;
  }

  /**
   * Finalise a trade: mark thread Accepted with `finalizedWithSeat`,
   * everyone else gets Rejected.
   */
  public finalize(id: string, recipientSeat: PlayerSeat): TradeOfferDto | undefined {
    const existing = this.offers.get(id);
    if (!existing) {
      return undefined;
    }
    const recipients = existing.recipients.map((slot) =>
      slot.seat === recipientSeat
        ? { ...slot, status: TradeRecipientStatus.Accepted }
        : { ...slot, status: TradeRecipientStatus.Rejected },
    );
    const next: TradeOfferDto = {
      ...existing,
      recipients,
      status: TradeStatus.Accepted,
      finalizedWithSeat: recipientSeat,
    };
    this.offers.set(id, next);
    return next;
  }

  /**
   * Close every open offer for the given lobby with the given terminal status
   * and return the resulting list so the caller can broadcast a
   * `TradeUpdated` per offer. Used on phase exit (Rejected) and on
   * propose-collision (Cancelled).
   */
  public closeOpenOffersForLobby(lobbyId: string, status: TradeStatus): TradeOfferDto[] {
    const closed: TradeOfferDto[] = [];
    for (const [id, offer] of this.offers) {
      if (offer.lobbyId !== lobbyId || offer.status !== TradeStatus.Open) {
        continue;
      }
      const next: TradeOfferDto = { ...offer, status };
      this.offers.set(id, next);
      closed.push(next);
    }
    return closed;
  }

  public findOpenOffersForLobby(lobbyId: string): TradeOfferDto[] {
    const open: TradeOfferDto[] = [];
    for (const offer of this.offers.values()) {
      if (offer.lobbyId === lobbyId && offer.status === TradeStatus.Open) {
        open.push(offer);
      }
    }
    return open;
  }
}
