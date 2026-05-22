import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ActionRejectCode,
  formatSocketIoLobbyRoomId,
  GamePhase,
  GameSocketServerEvent,
  PlayerSeat,
  TradeUpdateKind,
  type TradeOfferDto,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import type { Server, Socket } from 'socket.io';
import { RedisLobbyStoreService } from '../../infrastructure/redis/redis-lobby-store.service';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import {
  LobbyPlayerSlot,
  LobbyRuntime,
  pickFallbackHumanAdminSessionToken,
} from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';
import { TradeService } from '../trade/trade.service';

const PLAYER_DISCONNECT_GRACE_MS = 120_000;
const EMPTY_LOBBY_CLEANUP_DELAY_MS = 30_000;

/**
 * Owns the full disconnect ↔ reconnect lifecycle for player sockets:
 *
 *   socket drops → grace timer → reconnect rebinds OR grace expires →
 *   admin kick replaces with bot OR (no humans left) empty-lobby cleanup
 *
 * Also owns the *post-bind* resync emitted to a freshly-attached socket
 * (FullState + open-trade catch-up). Splitting these would force two
 * services to share `PLAYER_DISCONNECT_GRACE_MS`, `LobbyRuntime` timer
 * helpers, and the maybe-close-lobby check that fires from three call
 * sites — so they live together.
 *
 * Module-cycle note: this service depends on `LobbyService` for slot
 * mutation and `LobbyService.tearDownLobby` for cleanup. `LobbyService`
 * does NOT depend back — `removePlayerFromLobby` deliberately omits the
 * empty-lobby check, leaving each caller (disconnect path here, explicit
 * leave path in the orchestrator) to call `maybeCloseVideoLobby` itself.
 */
@Injectable()
export class ReconnectService {
  private readonly logger = new Logger(ReconnectService.name);

  public constructor(
    private readonly lobby: LobbyService,
    private readonly trades: TradeService,
    private readonly redisLobby: RedisLobbyStoreService,
    private readonly demoBots: DemoBotService,
  ) {}

  /**
   * Pushes everything the freshly-bound socket needs:
   *  1. FullState (board snapshot, broadcast to the whole lobby because the
   *     join/reconnect itself flipped this seat's `isConnected`).
   *  2. Trade resync targeted only at this socket — re-emit any open thread
   *     involving the seat so the client cache picks up trades that started
   *     while it was offline.
   *
   * Order matters: FullState first so the seat-context (selfSeat etc.) is
   * authoritative before the trade resync lands.
   */
  public syncSocketIntoLobby(
    server: Server,
    lobby: LobbyRuntime,
    socketId: string,
    seat: PlayerSeat,
  ): void {
    this.lobby.broadcastFullState(server, lobby);
    this.resyncOpenTradesForSocket(server, lobby.lobbyId, socketId, seat);
  }

  /**
   * Re-attach a fresh socket to a seat the same session token already owns.
   * Called from `GameGateway.handleConnection` after the access-token JWT
   * resolves — distinct from the explicit `JoinLobby` event flow (which goes
   * through `LobbyOrchestratorService.joinLobby` and emits `LobbyJoined`
   * with LiveKit credentials).
   */
  public async resumeSessionSocket(
    sessionToken: string,
    client: Socket,
    server: Server,
  ): Promise<void> {
    const found = this.lobby.findLobbyByPlayerToken(sessionToken);
    if (found === undefined) {
      return;
    }
    const { lobby, player } = found;
    if (player.isBot || lobby.isTearingDown) {
      return;
    }
    await client.join(formatSocketIoLobbyRoomId(lobby.lobbyId));
    lobby.timers.clearDisconnectTimer(player);
    player.socketId = client.id;
    player.disconnectGraceExpiresAt = null;
    player.awaitingAdminDecision = false;
    this.syncSocketIntoLobby(server, lobby, client.id, player.seat);
  }

  public onDisconnect(sessionToken: string, server: Server): void {
    const found = this.lobby.findLobbyByPlayerToken(sessionToken);
    if (found === undefined) {
      return;
    }
    const { lobby, player } = found;
    player.socketId = null;
    if (lobby.fsm.getPhase() === GamePhase.LobbyWaiting) {
      void this.lobby
        .removePlayerFromLobby(lobby, player, server, 'disconnect in lobby waiting')
        .then(() => this.maybeCloseVideoLobby(lobby))
        .catch((_error: unknown) => {
          this.logger.debug('removePlayerFromLobby after disconnect failed');
        });
      return;
    }
    player.disconnectGraceExpiresAt = Date.now() + PLAYER_DISCONNECT_GRACE_MS;
    player.awaitingAdminDecision = false;
    lobby.timers.startDisconnectHold(player, PLAYER_DISCONNECT_GRACE_MS, () => {
      this.onDisconnectGraceExpired(lobby, player, server);
    });
    this.lobby.broadcastFullState(server, lobby);
    void this.maybeCloseVideoLobby(lobby);
  }

  /**
   * Mutates the disconnected slot into a bot slot in place. Does NOT broadcast —
   * `GameService.kickAndReplaceWithBot` owns the broadcast + bot-autoplay drain
   * so the new bot actually takes its turn (matters in the setup phase).
   */
  public kickAndReplaceWithBot(
    lobbyId: string,
    requesterSessionToken: string,
    seat: PlayerSeat,
  ): LobbyRuntime {
    const lobby = this.lobby.requireLobby(lobbyId);
    this.lobby.assertLobbyOpen(lobby);
    this.lobby.ensureLobbyAdminConsistent(lobby);
    if (lobby.adminSessionToken !== requesterSessionToken) {
      throw new Error(ActionRejectCode.LobbyHostOnly);
    }
    const target = lobby.findPlayerBySeat(seat);
    if (!target || target.isBot) {
      throw new Error(ActionRejectCode.InvalidPayload);
    }
    if (!target.awaitingAdminDecision) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    const oldSessionToken = target.sessionToken;
    const wasAdmin = lobby.adminSessionToken === oldSessionToken;
    // Mutate the slot in place — slot identity carries the player's pieces, resources, devs.
    target.sessionToken = `bot-${randomUUID()}`;
    target.displayName = this.demoBots.getDemoBotDisplayName(seat);
    target.isBot = true;
    target.socketId = null;
    target.disconnectGraceExpiresAt = null;
    target.awaitingAdminDecision = false;
    lobby.timers.clearDisconnectTimer(target);
    if (wasAdmin) {
      lobby.adminSessionToken = pickFallbackHumanAdminSessionToken(lobby);
    }
    void this.redisLobby.removeMember(lobby.lobbyId, oldSessionToken).catch((_error: unknown) => {
      this.logger.debug('Redis removeMember failed');
    });
    this.logger.log(
      `admin ${requesterSessionToken} kicked seat ${seat} (${oldSessionToken}) in ${lobby.lobbyCode}, replaced with bot`,
    );
    return lobby;
  }

  /**
   * Public so the explicit-leave path in `LobbyOrchestratorService.leaveLobby`
   * can chain it after `LobbyService.removePlayerFromLobby` without pulling
   * the orchestrator into the reconnect-cycle responsibilities.
   */
  public async maybeCloseVideoLobby(lobby: LobbyRuntime): Promise<void> {
    if (this.lobby.countConnectedHumans(lobby) > 0) {
      lobby.timers.clearEmptyLobbyCleanupTimer();
      return;
    }
    if (lobby.timers.isEmptyLobbyCleanupPending() || lobby.isTearingDown) {
      return;
    }
    this.logger.log(
      `lobby ${lobby.lobbyCode} has no connected humans, scheduling cleanup in ${EMPTY_LOBBY_CLEANUP_DELAY_MS}ms`,
    );
    lobby.timers.startEmptyLobbyCleanupHold(EMPTY_LOBBY_CLEANUP_DELAY_MS, () => {
      void this.finalizeEmptyLobbyCleanup(lobby);
    });
  }

  private onDisconnectGraceExpired(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    server: Server,
  ): void {
    // Player slot lives on as `awaitingAdminDecision` — admin (or anyone reconnecting on
    // the same session token) decides next. The 30s no-connected-humans timer in
    // maybeCloseVideoLobby is the safety net if nobody is around to make that call.
    player.disconnectGraceExpiresAt = null;
    player.awaitingAdminDecision = true;
    this.logger.log(
      `grace expired for ${player.sessionToken} in ${lobby.lobbyCode}; awaiting admin decision`,
    );
    this.lobby.broadcastFullState(server, lobby);
    void this.maybeCloseVideoLobby(lobby);
  }

  private async finalizeEmptyLobbyCleanup(lobby: LobbyRuntime): Promise<void> {
    if (this.lobby.countConnectedHumans(lobby) > 0) {
      return;
    }
    if (lobby.isTearingDown) {
      return;
    }
    if (this.lobby.getLobby(lobby.lobbyId) !== lobby) {
      return;
    }
    await this.lobby.tearDownLobby(lobby, 'no connected humans');
  }

  private resyncOpenTradesForSocket(
    server: Server,
    lobbyId: string,
    socketId: string,
    seat: PlayerSeat,
  ): void {
    const open = this.trades.findOpenOffersForLobby(lobbyId);
    for (let i = 0; i < open.length; i += 1) {
      const trade = open[i];
      if (!this.tradeInvolvesSeat(trade, seat)) {
        continue;
      }
      const payload: TradeUpdatedPayload = {
        lobbyId: trade.lobbyId,
        trade,
        kind: TradeUpdateKind.Resync,
        actorSeat: trade.fromSeat,
      };
      server.to(socketId).emit(GameSocketServerEvent.TradeUpdated, payload);
    }
  }

  private tradeInvolvesSeat(trade: TradeOfferDto, seat: PlayerSeat): boolean {
    if (trade.fromSeat === seat) {
      return true;
    }
    for (let i = 0; i < trade.recipients.length; i += 1) {
      if (trade.recipients[i].seat === seat) {
        return true;
      }
    }
    return false;
  }
}
