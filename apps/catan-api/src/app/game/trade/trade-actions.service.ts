import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  GamePhase,
  PlayerSeat,
  ResourceType,
  TradeRecipientStatus,
  TradeStatus,
  type TradeAcceptPayload,
  type TradeCounterPayload,
  type TradeFinalizePayload,
  type TradeProposePayload,
  type TradeRejectPayload,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import type { LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';
import { TradeService } from './trade.service';

export interface TradeActionContext {
  getLobby(lobbyId: string): LobbyRuntime | undefined;
  broadcastLobby(lobby: LobbyRuntime): void;
}

export interface TradeActionResult {
  readonly cancelled: readonly TradeUpdatedPayload[];
  readonly updates: readonly TradeUpdatedPayload[];
  readonly lobbyId: string;
}

@Injectable()
export class TradeActionsService {
  public constructor(private readonly tradeService: TradeService) {}

  public proposeTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeProposePayload,
  ): TradeActionResult {
    const lobby = this.requireOpenLobby(context, payload.lobbyId);
    const from = this.requirePlayer(lobby, sessionToken);
    this.requireTradingPhase(lobby);
    if (from.seat !== lobby.currentSeat) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const recipients = this.normalizeRecipients(lobby, from.seat, payload.recipients);
    this.assertCanPayMap(from, payload.offer);
    // Supersede previous open offers FIRST so order on the wire is
    // Superseded→Open (Socket.IO preserves order). Superseded is distinct
    // from Cancelled so receivers don't briefly close the panel.
    const cancelledOffers = this.tradeService.closeOpenOffersForLobby(
      lobby.lobbyId,
      TradeStatus.Superseded,
    );
    const trade = this.tradeService.createOpenOffer(
      lobby,
      from.seat,
      recipients,
      payload.offer,
      payload.request,
    );
    const cancelled: TradeUpdatedPayload[] = cancelledOffers.map((offer) => ({
      lobbyId: lobby.lobbyId,
      trade: offer,
    }));
    return {
      cancelled,
      updates: [{ lobbyId: lobby.lobbyId, trade }],
      lobbyId: lobby.lobbyId,
    };
  }

  public acceptTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeAcceptPayload,
  ): TradeActionResult {
    const lobby = this.requireOpenLobby(context, payload.lobbyId);
    const actor = this.requirePlayer(lobby, sessionToken);
    this.requireTradingPhase(lobby);
    const offer = this.requireOpenOffer(payload.tradeId);
    const slot = this.requireRecipientSlot(offer, actor.seat);
    if (slot.status === TradeRecipientStatus.Accepted) {
      // No-op idempotency.
      return { cancelled: [], updates: [], lobbyId: lobby.lobbyId };
    }
    // Accept-as-recipient just records intent; resources move on finalize.
    this.assertCanPayMap(actor, offer.request);
    const updated = this.tradeService.updateRecipient(offer.id, actor.seat, {
      status: TradeRecipientStatus.Accepted,
      counter: undefined,
    });
    if (!updated) {
      return { cancelled: [], updates: [], lobbyId: lobby.lobbyId };
    }
    return {
      cancelled: [],
      updates: [{ lobbyId: lobby.lobbyId, trade: updated }],
      lobbyId: lobby.lobbyId,
    };
  }

  public counterTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeCounterPayload,
  ): TradeActionResult {
    const lobby = this.requireOpenLobby(context, payload.lobbyId);
    const actor = this.requirePlayer(lobby, sessionToken);
    this.requireTradingPhase(lobby);
    const offer = this.requireOpenOffer(payload.tradeId);
    this.requireRecipientSlot(offer, actor.seat);
    // counter.offer = what sender gives, counter.request = what sender receives
    // → recipient must own counter.request.
    this.assertCanPayMap(actor, payload.request);
    const updated = this.tradeService.updateRecipient(offer.id, actor.seat, {
      status: TradeRecipientStatus.Countered,
      counter: { offer: { ...payload.offer }, request: { ...payload.request } },
    });
    if (!updated) {
      return { cancelled: [], updates: [], lobbyId: lobby.lobbyId };
    }
    return {
      cancelled: [],
      updates: [{ lobbyId: lobby.lobbyId, trade: updated }],
      lobbyId: lobby.lobbyId,
    };
  }

  public rejectTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeRejectPayload,
  ): TradeActionResult {
    const lobby = this.requireOpenLobby(context, payload.lobbyId);
    const actor = this.requirePlayer(lobby, sessionToken);
    this.requireTradingPhase(lobby);
    const offer = this.requireOpenOffer(payload.tradeId);
    if (offer.fromSeat === actor.seat) {
      // Sender cancels the entire thread.
      const updated = this.tradeService.setStatus(offer.id, TradeStatus.Cancelled);
      if (!updated) {
        return { cancelled: [], updates: [], lobbyId: lobby.lobbyId };
      }
      return {
        cancelled: [],
        updates: [{ lobbyId: lobby.lobbyId, trade: updated }],
        lobbyId: lobby.lobbyId,
      };
    }
    // Recipient rejects own slot.
    this.requireRecipientSlot(offer, actor.seat);
    const updated = this.tradeService.updateRecipient(offer.id, actor.seat, {
      status: TradeRecipientStatus.Rejected,
      counter: undefined,
    });
    if (!updated) {
      return { cancelled: [], updates: [], lobbyId: lobby.lobbyId };
    }
    return {
      cancelled: [],
      updates: [{ lobbyId: lobby.lobbyId, trade: updated }],
      lobbyId: lobby.lobbyId,
    };
  }

  public finalizeTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeFinalizePayload,
  ): TradeActionResult {
    const lobby = this.requireOpenLobby(context, payload.lobbyId);
    const actor = this.requirePlayer(lobby, sessionToken);
    this.requireTradingPhase(lobby);
    const offer = this.requireOpenOffer(payload.tradeId);
    if (offer.fromSeat !== actor.seat) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const slot = this.requireRecipientSlot(offer, payload.recipientSeat);
    const recipient = lobby.findPlayerBySeat(payload.recipientSeat);
    if (!recipient) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    let giveMap: Readonly<Partial<Record<ResourceType, number>>>;
    let takeMap: Readonly<Partial<Record<ResourceType, number>>>;
    if (slot.status === TradeRecipientStatus.Countered && slot.counter !== undefined) {
      giveMap = slot.counter.offer;
      takeMap = slot.counter.request;
    } else if (slot.status === TradeRecipientStatus.Accepted) {
      giveMap = offer.offer;
      takeMap = offer.request;
    } else {
      throw new Error(ActionRejectCode.TradeNotOpen);
    }
    this.assertCanPayMap(actor, giveMap);
    this.assertCanPayMap(recipient, takeMap);
    this.applyResourceDelta(actor, giveMap, -1);
    this.applyResourceDelta(actor, takeMap, 1);
    this.applyResourceDelta(recipient, takeMap, -1);
    this.applyResourceDelta(recipient, giveMap, 1);
    const updated = this.tradeService.finalize(offer.id, payload.recipientSeat);
    context.broadcastLobby(lobby);
    if (!updated) {
      return { cancelled: [], updates: [], lobbyId: lobby.lobbyId };
    }
    return {
      cancelled: [],
      updates: [{ lobbyId: lobby.lobbyId, trade: updated }],
      lobbyId: lobby.lobbyId,
    };
  }

  private normalizeRecipients(
    lobby: LobbyRuntime,
    fromSeat: PlayerSeat,
    requested: readonly PlayerSeat[],
  ): PlayerSeat[] {
    if (requested.length === 0) {
      throw new Error(ActionRejectCode.InvalidPayload);
    }
    const seen = new Set<PlayerSeat>();
    const out: PlayerSeat[] = [];
    for (let i = 0; i < requested.length; i += 1) {
      const seat = requested[i];
      if (seat === fromSeat) {
        throw new Error(ActionRejectCode.NotYourTurn);
      }
      if (seen.has(seat)) {
        continue;
      }
      const player = lobby.findPlayerBySeat(seat);
      if (!player) {
        throw new Error(ActionRejectCode.PlayerNotInLobby);
      }
      seen.add(seat);
      out.push(seat);
    }
    return out;
  }

  private requireOpenLobby(context: TradeActionContext, lobbyId: string): LobbyRuntime {
    const lobby = context.getLobby(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    if (lobby.fsm.isFinished()) {
      throw new Error(ActionRejectCode.GameFinished);
    }
    return lobby;
  }

  private requirePlayer(lobby: LobbyRuntime, sessionToken: string): LobbyPlayerSlot {
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    return player;
  }

  private requireTradingPhase(lobby: LobbyRuntime): void {
    if (lobby.fsm.getPhase() !== GamePhase.Trading) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
  }

  private requireOpenOffer(tradeId: string) {
    const offer = this.tradeService.getOffer(tradeId);
    if (!offer || offer.status !== TradeStatus.Open) {
      throw new Error(ActionRejectCode.TradeNotOpen);
    }
    return offer;
  }

  private requireRecipientSlot(
    offer: ReturnType<TradeService['getOffer']> & object,
    seat: PlayerSeat,
  ) {
    if (!offer) {
      throw new Error(ActionRejectCode.TradeNotOpen);
    }
    for (let i = 0; i < offer.recipients.length; i += 1) {
      if (offer.recipients[i].seat === seat) {
        return offer.recipients[i];
      }
    }
    throw new Error(ActionRejectCode.NotYourTurn);
  }

  private assertCanPayMap(
    player: LobbyPlayerSlot,
    cost: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const keys = Object.keys(cost) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const need = cost[k] ?? 0;
      if ((player.resources[k] ?? 0) < need) {
        throw new Error(ActionRejectCode.InsufficientResources);
      }
    }
  }

  private applyResourceDelta(
    player: LobbyPlayerSlot,
    delta: Readonly<Partial<Record<ResourceType, number>>>,
    sign: 1 | -1,
  ): void {
    const keys = Object.keys(delta) as ResourceType[];
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const v = delta[k] ?? 0;
      player.resources[k] = (player.resources[k] ?? 0) + sign * v;
    }
  }
}
