import { forwardRef, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { GamePhase, PlayerSeat, ResourceType, TradeOfferDto, TradeRecipientStatus } from '@catan/api-interfaces';
import { Server } from 'socket.io';
import {
  CLOCKWISE_SEATS,
  type LobbyPlayerSlot,
  LobbyRuntime,
} from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';
import { BotLogicService, BotTradeDecisionKind, type BotAction } from './bot-logic.service';
import { BotManagementService } from './bot-management.service';
import { BOT_ACTION_DELAY_MS } from './bot.config';
import { GameService } from '../core/game.service';
import { TradeActionsService, type TradeActionContext } from '../trade/trade-actions.service';
import { TradeService } from '../trade/trade.service';
import { emitTradeUpdatedToInvolvedSockets } from '../trade/trade-emit.util';

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
    private readonly tradeActions: TradeActionsService,
    private readonly tradeService: TradeService,
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

  /**
   * Called after a trade is proposed so bots that are recipients can respond.
   * The callback receives the bot's session token and a decision ('accept' |
   * 'reject' | 'counter'); for counter it also receives the counter offer/request
   * in sender perspective (what sender gives, what sender receives).
   */
  public respondToTradeOffer(
    lobby: LobbyRuntime,
    trade: TradeOfferDto,
    respond: (
      botSession: string,
      decision: BotTradeDecisionKind,
      counterOffer?: Readonly<Partial<Record<ResourceType, number>>>,
      counterRequest?: Readonly<Partial<Record<ResourceType, number>>>,
    ) => void,
  ): void {
    for (let i = 0; i < trade.recipients.length; i += 1) {
      const botSession = this.management.resolveBotTradeAcceptorSessionToken(
        lobby,
        trade.recipients[i].seat,
      );
      if (botSession === null) {
        continue;
      }
      const bot = lobby.findPlayerBySeat(trade.recipients[i].seat);
      if (!bot) {
        continue;
      }
      const decision = this.logic.evaluateIncomingTrade(bot, trade.offer, trade.request);
      if (decision.kind === BotTradeDecisionKind.Counter) {
        respond(botSession, decision.kind, decision.offer, decision.request);
      } else {
        respond(botSession, decision.kind);
      }
    }
  }

  /**
   * Called after a TradeUpdated event so bots that proposed a trade can
   * finalize once a recipient has accepted.
   */
  public afterTradeUpdated(lobbyId: string, trade: TradeOfferDto, server: Server): void {
    const lobby = this.lobbyService.getLobby(lobbyId);
    if (!lobby) {
      return;
    }
    const sender = lobby.findPlayerBySeat(trade.fromSeat);
    if (!sender || !this.management.isBotSessionToken(sender.sessionToken)) {
      return;
    }
    if (lobby.fsm.getPhase() !== GamePhase.Trading) {
      return;
    }
    if (this.mainGameTicks.has(lobbyId)) {
      return;
    }
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

    if (phase === GamePhase.Trading) {
      this.executeTradingPhaseAction(lobby, current, lobbyId, server);
      return;
    }

    const action = this.logic.decideMainGameAction(lobby, current);
    this.logger.debug(`bot action: seat=${current.seat} phase=${phase} action=${action.type}`);
    this.dispatchAction(action, lobbyId, current.sessionToken, server);
  }

  private executeTradingPhaseAction(
    lobby: LobbyRuntime,
    bot: LobbyPlayerSlot,
    lobbyId: string,
    server: Server,
  ): void {
    const openTrades = this.tradeService.findOpenOffersForLobby(lobbyId);
    const botTrade = openTrades.find((t) => t.fromSeat === bot.seat);

    if (botTrade) {
      const acceptedSlot = botTrade.recipients.find(
        (r) => r.status === TradeRecipientStatus.Accepted,
      );
      if (acceptedSlot) {
        this.logger.debug(`bot finalizing trade: lobby=${lobbyId} seat=${bot.seat} recipient=${acceptedSlot.seat}`);
        this.dispatchBotTradeFinalize(botTrade.id, acceptedSlot.seat, bot.sessionToken, lobbyId, server);
        return;
      }

      const counteredSlot = botTrade.recipients.find(
        (r) => r.status === TradeRecipientStatus.Countered && r.counter !== undefined,
      );
      if (counteredSlot && counteredSlot.counter !== undefined) {
        // counter stored in sender (bot) perspective: offer = bot gives, request = bot receives
        const counterDecision = this.logic.evaluateIncomingTrade(
          bot,
          counteredSlot.counter.request,
          counteredSlot.counter.offer,
        );
        if (counterDecision.kind === BotTradeDecisionKind.Accept) {
          this.logger.debug(`bot finalizing counter: lobby=${lobbyId} seat=${bot.seat} recipient=${counteredSlot.seat}`);
          this.dispatchBotTradeFinalize(botTrade.id, counteredSlot.seat, bot.sessionToken, lobbyId, server);
          return;
        }
        this.logger.debug(`bot rejecting counter: lobby=${lobbyId} seat=${bot.seat}`);
        this.gameService.finishTrading(lobbyId, bot.sessionToken, server);
        return;
      }

      const allResolved = botTrade.recipients.every(
        (r) =>
          r.status === TradeRecipientStatus.Rejected ||
          r.status === TradeRecipientStatus.Accepted,
      );
      if (!allResolved) {
        // Still waiting for responses — do not complete trading yet.
        return;
      }
    }

    // No open trade from this bot or all recipients resolved without acceptance.
    const proposal = this.buildBotTradeProposal(lobby, bot);
    if (proposal !== null && botTrade === undefined) {
      this.logger.debug(`bot proposing trade: lobby=${lobbyId} seat=${bot.seat}`);
      this.dispatchBotTradePropose(proposal, lobbyId, bot.sessionToken, lobby, server);
      return;
    }

    this.logger.debug(`bot completing trading: lobby=${lobbyId} seat=${bot.seat}`);
    this.gameService.finishTrading(lobbyId, bot.sessionToken, server);
  }

  private dispatchBotTradeFinalize(
    tradeId: string,
    recipientSeat: PlayerSeat,
    sessionToken: string,
    lobbyId: string,
    server: Server,
  ): void {
    const ctx = this.makeBotTradeContext(server);
    const result = this.tradeActions.finalizeTrade(ctx, sessionToken, {
      lobbyId,
      tradeId,
      recipientSeat,
    });
    const lobby = this.lobbyService.getLobby(lobbyId);
    if (lobby) {
      for (let i = 0; i < result.updates.length; i += 1) {
        emitTradeUpdatedToInvolvedSockets(server, lobby, result.updates[i]);
      }
    }
  }

  private dispatchBotTradePropose(
    proposal: {
      recipients: PlayerSeat[];
      offer: Partial<Record<ResourceType, number>>;
      request: Partial<Record<ResourceType, number>>;
    },
    lobbyId: string,
    sessionToken: string,
    lobby: LobbyRuntime,
    server: Server,
  ): void {
    const ctx = this.makeBotTradeContext(server);
    const result = this.tradeActions.proposeTrade(ctx, sessionToken, {
      lobbyId,
      recipients: proposal.recipients,
      offer: proposal.offer,
      request: proposal.request,
    });
    for (let i = 0; i < result.cancelled.length; i += 1) {
      emitTradeUpdatedToInvolvedSockets(server, lobby, result.cancelled[i]);
    }
    for (let i = 0; i < result.updates.length; i += 1) {
      emitTradeUpdatedToInvolvedSockets(server, lobby, result.updates[i]);
    }
  }

  private buildBotTradeProposal(
    lobby: LobbyRuntime,
    bot: LobbyPlayerSlot,
  ): {
    recipients: PlayerSeat[];
    offer: Partial<Record<ResourceType, number>>;
    request: Partial<Record<ResourceType, number>>;
  } | null {
    const resources = Object.values(ResourceType);
    let surplusResource: ResourceType | null = null;
    let neededResource: ResourceType | null = null;

    for (let i = 0; i < resources.length; i += 1) {
      const r = resources[i];
      const count = bot.resources[r] ?? 0;
      if (count >= 2 && surplusResource === null) {
        surplusResource = r;
      }
      if (count === 0 && neededResource === null) {
        neededResource = r;
      }
    }

    if (surplusResource === null || neededResource === null) {
      return null;
    }

    const recipients: PlayerSeat[] = [];
    for (let i = 0; i < lobby.players.length; i += 1) {
      const p = lobby.players[i];
      if (p.seat === bot.seat) {
        continue;
      }
      if (this.management.isBotSessionToken(p.sessionToken)) {
        continue;
      }
      if ((p.resources[neededResource] ?? 0) > 0) {
        recipients.push(p.seat);
      }
    }

    if (recipients.length === 0) {
      return null;
    }

    return {
      recipients,
      offer: { [surplusResource]: 1 },
      request: { [neededResource]: 1 },
    };
  }

  private makeBotTradeContext(server: Server): TradeActionContext {
    return {
      getLobby: (lobbyId: string) => this.lobbyService.getLobby(lobbyId),
      broadcastLobby: (lobby: LobbyRuntime) => this.gameService.broadcastFullState(server, lobby),
    };
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
