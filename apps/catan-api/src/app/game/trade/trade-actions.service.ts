import { Injectable } from '@nestjs/common';
import {
  ActionRejectCode,
  GamePhase,
  ResourceType,
  TradeStatus,
  type TradeAcceptPayload,
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

@Injectable()
export class TradeActionsService {
  public constructor(private readonly tradeService: TradeService) {}

  public proposeTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeProposePayload,
  ): TradeUpdatedPayload {
    const lobby = context.getLobby(payload.lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    const from = lobby.findPlayerByToken(sessionToken);
    if (!from) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (lobby.fsm.getPhase() !== GamePhase.Trading) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    if (from.seat !== lobby.currentSeat) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const trade = this.tradeService.createOpenOffer(lobby, from, payload);
    return { lobbyId: lobby.lobbyId, trade };
  }

  public acceptTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeAcceptPayload,
  ): { tradeUpdated: TradeUpdatedPayload | null; lobbyId: string } {
    const lobby = context.getLobby(payload.lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    const accepter = lobby.findPlayerByToken(sessionToken);
    if (!accepter) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (lobby.fsm.getPhase() !== GamePhase.Trading) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    const offer = this.tradeService.getOffer(payload.tradeId);
    if (!offer || offer.status !== TradeStatus.Open) {
      throw new Error(ActionRejectCode.TradeNotOpen);
    }
    if (offer.toSeat !== accepter.seat) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const from = lobby.findPlayerBySeat(offer.fromSeat);
    if (!from) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    this.assertCanPayMap(from, offer.offer);
    this.assertCanPayMap(accepter, offer.request);
    this.applyResourceDelta(from, offer.offer, -1);
    this.applyResourceDelta(from, offer.request, 1);
    this.applyResourceDelta(accepter, offer.request, -1);
    this.applyResourceDelta(accepter, offer.offer, 1);
    const updated = this.tradeService.setStatus(offer.id, TradeStatus.Accepted);
    context.broadcastLobby(lobby);
    if (!updated) {
      return { tradeUpdated: null, lobbyId: lobby.lobbyId };
    }
    return {
      tradeUpdated: { lobbyId: lobby.lobbyId, trade: updated },
      lobbyId: lobby.lobbyId,
    };
  }

  public rejectTrade(
    context: TradeActionContext,
    sessionToken: string,
    payload: TradeRejectPayload,
  ): { tradeUpdated: TradeUpdatedPayload | null; lobbyId: string } {
    const lobby = context.getLobby(payload.lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.assertLobbyOpen(lobby);
    const actor = lobby.findPlayerByToken(sessionToken);
    if (!actor) {
      throw new Error(ActionRejectCode.PlayerNotInLobby);
    }
    if (lobby.fsm.getPhase() !== GamePhase.Trading) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    const offer = this.tradeService.getOffer(payload.tradeId);
    if (!offer || offer.status !== TradeStatus.Open) {
      throw new Error(ActionRejectCode.TradeNotOpen);
    }
    if (offer.fromSeat !== actor.seat && offer.toSeat !== actor.seat) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const updated = this.tradeService.setStatus(offer.id, TradeStatus.Rejected);
    if (!updated) {
      return { tradeUpdated: null, lobbyId: lobby.lobbyId };
    }
    return {
      tradeUpdated: { lobbyId: lobby.lobbyId, trade: updated },
      lobbyId: lobby.lobbyId,
    };
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

  private assertLobbyOpen(lobby: LobbyRuntime): void {
    if (lobby.fsm.isFinished()) {
      throw new Error(ActionRejectCode.GameFinished);
    }
  }
}
