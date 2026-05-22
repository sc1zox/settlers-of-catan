import { Injectable, Logger } from '@nestjs/common';
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
import { BOT_MAIN_GAME_DRAIN_MAX_STEPS, BOT_SETUP_AUTOPLAY_MAX_STEPS } from './bot.config';

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

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly autoplayLobbyIds = new Set<string>();
  private mainGameDrainActive = false;

  public constructor(
    private readonly logic: BotLogicService,
    private readonly management: BotManagementService,
  ) {}

  public afterLobbyBroadcast(
    lobbyId: string,
    server: Server,
    callbacks: BotMainGameCallbacks,
  ): void {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby) {
      return;
    }
    if (this.mainGameDrainActive) {
      return;
    }
    this.mainGameDrainActive = true;
    try {
      for (let step = 0; step < BOT_MAIN_GAME_DRAIN_MAX_STEPS; step += 1) {
        try {
          if (!this.tryOneMainGameAction(lobbyId, server, callbacks)) {
            return;
          }
        } catch (error: unknown) {
          this.logAutoplayFailure(lobbyId, error);
          return;
        }
      }
    } finally {
      this.mainGameDrainActive = false;
    }
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

  public runSetupAutoplay(
    lobbyId: string,
    server: Server,
    callbacks: BotSetupCallbacks,
  ): void {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby) {
      return;
    }
    if (this.autoplayLobbyIds.has(lobbyId)) {
      return;
    }
    this.autoplayLobbyIds.add(lobbyId);
    try {
      this.runSetupAutoplayStep(lobbyId, server, callbacks, 0);
    } finally {
      this.autoplayLobbyIds.delete(lobbyId);
    }
  }

  private runSetupAutoplayStep(
    lobbyId: string,
    server: Server,
    callbacks: BotSetupCallbacks,
    depth: number,
  ): void {
    if (depth >= BOT_SETUP_AUTOPLAY_MAX_STEPS) {
      return;
    }
    const nextLobby = callbacks.getLobby(lobbyId);
    if (!nextLobby) {
      return;
    }
    const phase = nextLobby.fsm.getPhase();
    if (!this.isSetupPhase(phase)) {
      return;
    }
    const current = nextLobby.findPlayerBySeat(nextLobby.currentSeat);
    if (!current || !this.management.isBotSessionToken(current.sessionToken)) {
      return;
    }
    if (
      !this.runSingleSetupBotTurn(lobbyId, nextLobby, current, server, callbacks)
    ) {
      return;
    }
    this.runSetupAutoplayStep(lobbyId, server, callbacks, depth + 1);
  }

  private runSingleSetupBotTurn(
    lobbyId: string,
    lobby: LobbyRuntime,
    bot: LobbyPlayerSlot,
    server: Server,
    callbacks: BotSetupCallbacks,
  ): boolean {
    const settlementVertexId = this.logic.pickLegalSetupSettlementVertex(lobby, bot);
    if (settlementVertexId === null) {
      return false;
    }
    try {
      callbacks.buildSettlement(lobbyId, bot.sessionToken, settlementVertexId, server);
    } catch (error: unknown) {
      this.logAutoplayFailure(lobbyId, error);
      return false;
    }
    const pendingVertexId = lobby.pendingSetupRoadFromVertexId;
    if (pendingVertexId === null) {
      return false;
    }
    const roadEdgeId = this.logic.pickLegalSetupRoadEdge(lobby, bot, pendingVertexId);
    if (roadEdgeId === null) {
      return false;
    }
    try {
      callbacks.buildRoad(lobbyId, bot.sessionToken, roadEdgeId, server);
    } catch (error: unknown) {
      this.logAutoplayFailure(lobbyId, error);
      return false;
    }
    return true;
  }

  private logAutoplayFailure(_lobbyId: string, _error: unknown): void {
    this.logger.debug('Bot autoplay step skipped');
  }

  private tryOneMainGameAction(
    lobbyId: string,
    server: Server,
    callbacks: BotMainGameCallbacks,
  ): boolean {
    const lobby = callbacks.getLobby(lobbyId);
    if (!lobby) {
      return false;
    }
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
      const bot = this.firstBotNeedingRobberDiscard(lobby);
      if (bot === undefined) {
        return false;
      }
      const action = this.logic.pickRobberDiscard(lobby, bot);
      if (action.type === 'discard') {
        callbacks.submitRobberDiscard(lobbyId, bot.sessionToken, action.resources, server);
        return true;
      }
      return false;
    }

    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    if (!current || !this.management.isBotSessionToken(current.sessionToken)) {
      return false;
    }

    const action = this.logic.decideMainGameAction(lobby, current);
    switch (action.type) {
      case 'rollDice':
        callbacks.rollDice(lobbyId, current.sessionToken, server);
        return true;
      case 'moveRobber':
        callbacks.moveRobber(lobbyId, current.sessionToken, action.q, action.r, action.victimSeat, server);
        return true;
      case 'completeTrading':
        callbacks.completeTradingPhaseAndExpireOffers(lobbyId, current.sessionToken, server);
        return true;
      case 'buildCity':
        callbacks.buildCity(lobbyId, current.sessionToken, action.vertexId, server);
        return true;
      case 'buildSettlement':
        callbacks.buildSettlement(lobbyId, current.sessionToken, action.vertexId, server);
        return true;
      case 'buyDevCard':
        callbacks.buyDevCard(lobbyId, current.sessionToken, server);
        return true;
      case 'buildRoad':
        callbacks.buildRoad(lobbyId, current.sessionToken, action.edgeId, server);
        return true;
      case 'endTurn':
        callbacks.endTurn(lobbyId, current.sessionToken, server);
        return true;
      default:
        return false;
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
