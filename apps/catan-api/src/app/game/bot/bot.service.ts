import { forwardRef, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { GamePhase, PlayerSeat } from '@catan/api-interfaces';
import { Server } from 'socket.io';
import {
  CLOCKWISE_SEATS,
  type LobbyPlayerSlot,
  LobbyRuntime,
} from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';
import { BotLogicService, type BotAction } from './bot-logic.service';
import { BotManagementService } from './bot-management.service';
import { BOT_ACTION_DELAY_MS } from './bot.config';
import { GameService } from '../core/game.service';

@Injectable()
export class BotService implements OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly setupTicks = new Map<string, NodeJS.Timeout>();
  private readonly mainGameTicks = new Map<string, NodeJS.Timeout>();

  public constructor(
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly lobbyService: LobbyService,
    private readonly logic: BotLogicService,
    private readonly management: BotManagementService,
  ) {}

  public onModuleDestroy(): void {
    for (const timer of this.setupTicks.values()) clearTimeout(timer);
    for (const timer of this.mainGameTicks.values()) clearTimeout(timer);
    this.setupTicks.clear();
    this.mainGameTicks.clear();
  }

  public afterLobbyBroadcast(lobbyId: string, server: Server): void {
    if (this.mainGameTicks.has(lobbyId)) return;
    if (!this.hasPendingMainGameBotAction(lobbyId)) return;
    const lobby = this.lobbyService.getLobby(lobbyId);
    const phase = lobby?.fsm.getPhase();
    const seat = lobby?.currentSeat;
    this.logger.debug(`scheduling bot tick: lobby=${lobbyId} phase=${phase} seat=${seat}`);
    const timer = setTimeout(() => {
      this.mainGameTicks.delete(lobbyId);
      try {
        this.executeMainGameAction(lobbyId, server);
      } catch (error: unknown) {
        this.logAutoplayFailure(lobbyId, error);
        this.scheduleRetryIfStillPending(lobbyId, server);
      }
    }, BOT_ACTION_DELAY_MS);
    this.mainGameTicks.set(lobbyId, timer);
  }

  public runSetupAutoplay(lobbyId: string, server: Server): void {
    if (this.setupTicks.has(lobbyId)) return;
    if (!this.hasPendingSetupBotAction(lobbyId)) return;
    const timer = setTimeout(() => {
      this.setupTicks.delete(lobbyId);
      try {
        this.executeSetupAction(lobbyId, server);
      } catch (error: unknown) {
        this.logAutoplayFailure(lobbyId, error);
        this.scheduleSetupRetryIfStillPending(lobbyId, server);
      }
    }, BOT_ACTION_DELAY_MS);
    this.setupTicks.set(lobbyId, timer);
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

  private executeMainGameAction(lobbyId: string, server: Server): void {
    const lobby = this.lobbyService.getLobby(lobbyId);
    if (!lobby) {
      this.logger.warn(`bot tick: lobby ${lobbyId} not found`);
      return;
    }
    const phase = lobby.fsm.getPhase();
    if (this.isInactivePhase(phase)) {
      return;
    }

    if (phase === GamePhase.RobberDiscard) {
      this.handleRobberDiscard(lobby, lobbyId, server);
      return;
    }

    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    if (!current || !this.management.isBotSessionToken(current.sessionToken)) {
      return;
    }

    const action = this.logic.decideMainGameAction(lobby, current);
    this.logger.debug(`bot action: seat=${current.seat} phase=${phase} action=${action.type}`);
    this.dispatchAction(action, lobbyId, current.sessionToken, server);
  }

  private dispatchAction(
    action: BotAction,
    lobbyId: string,
    sessionToken: string,
    server: Server,
  ): void {
    switch (action.type) {
      case 'rollDice':
        this.gameService.rollDice(lobbyId, sessionToken, server);
        return;
      case 'moveRobber':
        this.gameService.moveRobber(lobbyId, sessionToken, action.q, action.r, action.victimSeat, server);
        return;
      case 'completeTrading':
        this.gameService.finishTrading(lobbyId, sessionToken, server);
        return;
      case 'buildSettlement':
        this.gameService.buildSettlement(lobbyId, sessionToken, action.vertexId, server);
        return;
      case 'buildCity':
        this.gameService.buildCity(lobbyId, sessionToken, action.vertexId, server);
        return;
      case 'buildRoad':
        this.gameService.buildRoad(lobbyId, sessionToken, action.edgeId, server);
        return;
      case 'buyDevCard':
        this.gameService.buyDevCard(lobbyId, sessionToken, server);
        return;
      case 'endTurn':
        this.gameService.endTurn(lobbyId, sessionToken, server);
        return;
      case 'discard':
        this.gameService.submitRobberDiscard(lobbyId, sessionToken, action.resources, server);
        return;
      default:
        this.logger.warn(`Bot has no action for lobby ${lobbyId}`);
        return;
    }
  }

  private handleRobberDiscard(lobby: LobbyRuntime, lobbyId: string, server: Server): void {
    const bot = this.firstBotNeedingRobberDiscard(lobby);
    if (bot === undefined) {
      return;
    }
    const action = this.logic.pickRobberDiscard(lobby, bot);
    if (action.type === 'discard') {
      this.gameService.submitRobberDiscard(lobbyId, bot.sessionToken, action.resources, server);
    }
  }

  private executeSetupAction(lobbyId: string, server: Server): void {
    const lobby = this.lobbyService.getLobby(lobbyId);
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
      this.gameService.buildRoad(lobbyId, current.sessionToken, roadEdgeId, server);
      return;
    }
    const settlementVertexId = this.logic.pickLegalSetupSettlementVertex(lobby, current);
    if (settlementVertexId === null) return;
    this.gameService.buildSettlement(lobbyId, current.sessionToken, settlementVertexId, server);
  }

  private hasPendingMainGameBotAction(lobbyId: string): boolean {
    const lobby = this.lobbyService.getLobby(lobbyId);
    if (!lobby) return false;
    const phase = lobby.fsm.getPhase();
    if (this.isInactivePhase(phase)) {
      return false;
    }
    if (phase === GamePhase.RobberDiscard) {
      return this.firstBotNeedingRobberDiscard(lobby) !== undefined;
    }
    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    return current !== undefined && this.management.isBotSessionToken(current.sessionToken);
  }

  private hasPendingSetupBotAction(lobbyId: string): boolean {
    const lobby = this.lobbyService.getLobby(lobbyId);
    if (!lobby) return false;
    if (!this.isSetupPhase(lobby.fsm.getPhase())) return false;
    const current = lobby.findPlayerBySeat(lobby.currentSeat);
    return current !== undefined && this.management.isBotSessionToken(current.sessionToken);
  }

  private scheduleRetryIfStillPending(lobbyId: string, server: Server): void {
    if (this.mainGameTicks.has(lobbyId)) return;
    if (!this.hasPendingMainGameBotAction(lobbyId)) return;
    const retry = setTimeout(() => {
      this.mainGameTicks.delete(lobbyId);
      try {
        this.executeMainGameAction(lobbyId, server);
      } catch (error: unknown) {
        this.logAutoplayFailure(lobbyId, error);
      }
    }, BOT_ACTION_DELAY_MS);
    this.mainGameTicks.set(lobbyId, retry);
  }

  private scheduleSetupRetryIfStillPending(lobbyId: string, server: Server): void {
    if (this.setupTicks.has(lobbyId)) return;
    if (!this.hasPendingSetupBotAction(lobbyId)) return;
    const retry = setTimeout(() => {
      this.setupTicks.delete(lobbyId);
      try {
        this.executeSetupAction(lobbyId, server);
      } catch (error: unknown) {
        this.logAutoplayFailure(lobbyId, error);
      }
    }, BOT_ACTION_DELAY_MS);
    this.setupTicks.set(lobbyId, retry);
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

  private isInactivePhase(phase: GamePhase): boolean {
    return (
      phase === GamePhase.LobbyWaiting ||
      phase === GamePhase.SetupForward ||
      phase === GamePhase.SetupBackward ||
      phase === GamePhase.Finished ||
      phase === GamePhase.Summary
    );
  }

  private isSetupPhase(phase: GamePhase): boolean {
    return phase === GamePhase.SetupForward || phase === GamePhase.SetupBackward;
  }

  private logAutoplayFailure(lobbyId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Bot autoplay failed in lobby ${lobbyId}: ${message}`);
  }
}
