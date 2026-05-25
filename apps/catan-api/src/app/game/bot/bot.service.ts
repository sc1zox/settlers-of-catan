import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { GamePhase, PlayerSeat, ResourceType } from '@catan/api-interfaces';
import { Server } from 'socket.io';
import {
  CLOCKWISE_SEATS,
  getOccupiedSeatsClockwise,
  type LobbyPlayerSlot,
  LobbyRuntime,
} from '../lobby/lobby-runtime';
import { BotLogicService } from './bot-logic.service';
import { BotManagementService } from './bot-management.service';
import { BOT_ACTION_DELAY_MS } from './bot.config';

export interface BotSetupCallbacks {
  getLobby(lobbyId: string): LobbyRuntime | undefined;
  buildSettlement(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void;
  buildRoad(lobbyId: string, sessionToken: string, edgeId: string, server: Server): void;
}

export interface BotMainGameCallbacks {
  getLobby(lobbyId: string): LobbyRuntime | undefined;
  rollDice(lobbyId: string, sessionToken: string, server: Server): void;
  completeTradingPhaseAndExpireOffers(lobbyId: string, sessionToken: string, server: Server): void;
  endTurn(lobbyId: string, sessionToken: string, server: Server): void;
  submitRobberDiscard(
    lobbyId: string,
    sessionToken: string,
    discard: Readonly<Partial<Record<ResourceType, number>>>,
    server: Server,
  ): void;
  moveRobber(
    lobbyId: string,
    sessionToken: string,
    q: number,
    r: number,
    victimSeat: PlayerSeat | undefined,
    server: Server,
  ): void;
  buildSettlement(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void;
  buildRoad(lobbyId: string, sessionToken: string, edgeId: string, server: Server): void;
  buildCity(lobbyId: string, sessionToken: string, vertexId: string, server: Server): void;
  buyDevCard(lobbyId: string, sessionToken: string, server: Server): void;
}

/**
 * Drives bots one action at a time on a timer. A bot's placement triggers a
 * FullState broadcast, the broadcast hook schedules the next tick, and the
 * chain stops when no bot needs to act. The pacing matches the client's
 * arsenal fly-in duration so each piece reveals before the next one starts.
 */
@Injectable()
export class BotService implements OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly setupTicks = new Map<string, NodeJS.Timeout>();
  private readonly mainGameTicks = new Map<string, NodeJS.Timeout>();

  public constructor(
    private readonly logic: BotLogicService,
    private readonly management: BotManagementService,
  ) {}

  public onModuleDestroy(): void {
    for (const timer of this.setupTicks.values()) clearTimeout(timer);
    for (const timer of this.mainGameTicks.values()) clearTimeout(timer);
    this.setupTicks.clear();
    this.mainGameTicks.clear();
  }

  public afterLobbyBroadcast(
    lobbyId: string,
    server: Server,
    callbacks: BotMainGameCallbacks,
  ): void {
    if (this.mainGameTicks.has(lobbyId)) return;
    if (!this.hasPendingMainGameBotAction(lobbyId, callbacks)) return;
    const timer = setTimeout(() => {
      this.mainGameTicks.delete(lobbyId);
      try {
        this.tryOneMainGameAction(lobbyId, server, callbacks);
      } catch (error: unknown) {
        this.logAutoplayFailure(lobbyId, error);
      }
    }, BOT_ACTION_DELAY_MS);
    this.mainGameTicks.set(lobbyId, timer);
  }

  public runSetupAutoplay(
    lobbyId: string,
    server: Server,
    callbacks: BotSetupCallbacks,
  ): void {
    if (this.setupTicks.has(lobbyId)) return;
    if (!this.hasPendingSetupBotAction(lobbyId, callbacks)) return;
    const timer = setTimeout(() => {
      this.setupTicks.delete(lobbyId);
      try {
        this.runOneSetupAction(lobbyId, server, callbacks);
      } catch (error: unknown) {
        this.logAutoplayFailure(lobbyId, error);
      }
    }, BOT_ACTION_DELAY_MS);
    this.setupTicks.set(lobbyId, timer);
  }

  public getActiveTurnSeats(lobby: LobbyRuntime): PlayerSeat[] {
    return getOccupiedSeatsClockwise(lobby);
  }

  public respondToTradePropose(
    lobby: LobbyRuntime,
    recipients: readonly { readonly seat: PlayerSeat }[],
    tryAccept: (botSessionToken: string) => void,
    fallbackReject: (botSessionToken: string) => void,
  ): void {
    for (let i = 0; i < recipients.length; i += 1) {
      const botSession = this.management.resolveBotTradeAcceptorSessionToken(lobby, recipients[i].seat);
      if (botSession === null) {
        continue;
      }
      try {
        tryAccept(botSession);
      } catch {
        fallbackReject(botSession);
      }
    }
  }

  private hasPendingSetupBotAction(lobbyId: string, callbacks: BotSetupCallbacks): boolean {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby) return false;
    if (!this.isSetupPhase(lobby.fsm.getPhase())) return false;
    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    return current !== undefined && this.management.isBotSessionToken(current.sessionToken);
  }

  private hasPendingMainGameBotAction(
    lobbyId: string,
    callbacks: BotMainGameCallbacks,
  ): boolean {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby) return false;
    const phase = lobby.fsm.getPhase();
    if (
      phase === GamePhase.LobbyWaiting ||
      phase === GamePhase.SetupForward ||
      phase === GamePhase.SetupBackward ||
      phase === GamePhase.Finished ||
      phase === GamePhase.Summary
    ) {
      return false;
    }
    if (phase === GamePhase.RobberDiscard) {
      return this.firstBotNeedingRobberDiscard(lobby) !== undefined;
    }
    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    return current !== undefined && this.management.isBotSessionToken(current.sessionToken);
  }

  private runOneSetupAction(
    lobbyId: string,
    server: Server,
    callbacks: BotSetupCallbacks,
  ): void {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby) return;
    if (!this.isSetupPhase(lobby.fsm.getPhase())) return;
    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    if (!current || !this.management.isBotSessionToken(current.sessionToken)) {
      return;
    }
    if (
      lobby.pendingSetupRoadSeat === current.seat &&
      lobby.pendingSetupRoadFromVertexId !== null
    ) {
      const roadEdgeId = this.logic.pickLegalSetupRoadEdge(
        lobby,
        current,
        lobby.pendingSetupRoadFromVertexId,
      );
      if (roadEdgeId === null) return;
      callbacks.buildRoad(lobbyId, current.sessionToken, roadEdgeId, server);
      return;
    }
    const settlementVertexId = this.logic.pickLegalSetupSettlementVertex(lobby, current);
    if (settlementVertexId === null) return;
    callbacks.buildSettlement(lobbyId, current.sessionToken, settlementVertexId, server);
  }

  private logAutoplayFailure(_lobbyId: string, _error: unknown): void {
    this.logger.debug('Bot autoplay step skipped');
  }

  private tryOneMainGameAction(
    lobbyId: string,
    server: Server,
    callbacks: BotMainGameCallbacks,
  ): void {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby) return;
    const phase = lobby.fsm.getPhase();
    if (
      phase === GamePhase.LobbyWaiting ||
      phase === GamePhase.SetupForward ||
      phase === GamePhase.SetupBackward ||
      phase === GamePhase.Finished ||
      phase === GamePhase.Summary
    ) {
      return;
    }

    if (phase === GamePhase.RobberDiscard) {
      const bot = this.firstBotNeedingRobberDiscard(lobby);
      if (bot === undefined) return;
      const action = this.logic.pickRobberDiscard(lobby, bot);
      if (action.type === 'discard') {
        callbacks.submitRobberDiscard(lobbyId, bot.sessionToken, action.resources, server);
      }
      return;
    }

    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    if (!current || !this.management.isBotSessionToken(current.sessionToken)) {
      return;
    }

    const action = this.logic.decideMainGameAction(lobby, current);
    switch (action.type) {
      case 'rollDice':
        callbacks.rollDice(lobbyId, current.sessionToken, server);
        return;
      case 'moveRobber':
        callbacks.moveRobber(lobbyId, current.sessionToken, action.q, action.r, action.victimSeat, server);
        return;
      case 'completeTrading':
        callbacks.completeTradingPhaseAndExpireOffers(lobbyId, current.sessionToken, server);
        return;
      case 'buildCity':
        callbacks.buildCity(lobbyId, current.sessionToken, action.vertexId, server);
        return;
      case 'buildSettlement':
        callbacks.buildSettlement(lobbyId, current.sessionToken, action.vertexId, server);
        return;
      case 'buyDevCard':
        callbacks.buyDevCard(lobbyId, current.sessionToken, server);
        return;
      case 'buildRoad':
        callbacks.buildRoad(lobbyId, current.sessionToken, action.edgeId, server);
        return;
      case 'endTurn':
        callbacks.endTurn(lobbyId, current.sessionToken, server);
        return;
      default:
        return;
    }
  }

  private firstBotNeedingRobberDiscard(lobby: LobbyRuntime): LobbyPlayerSlot | undefined {
    for (let i = 0; i < CLOCKWISE_SEATS.length; i += 1) {
      const seat = CLOCKWISE_SEATS[i];
      if (!lobby.pendingRobberDiscardSeats.includes(seat)) {
        continue;
      }
      const player = lobby.findPlayerBySeat(seat);
      if (player && this.management.isBotSessionToken(player.sessionToken)) {
        return player;
      }
    }
    return undefined;
  }

  private isSetupPhase(phase: GamePhase): boolean {
    return phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward;
  }
}
