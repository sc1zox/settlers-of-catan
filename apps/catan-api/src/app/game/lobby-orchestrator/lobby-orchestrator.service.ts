import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ActionRejectCode,
  formatSocketIoLobbyRoomId,
  GamePhase,
  GameSocketServerEvent,
  isLobbyCodeValid,
  LobbyTerminationReason,
  normalizeLobbyCode,
  PlayerSeat,
  type LobbyJoinedPayload,
  type LobbyTerminatedPayload,
} from '@catan/api-interfaces';
import { Server, Socket } from 'socket.io';
import { LiveKitRoomService } from '../../infrastructure/livekit/livekit-room.service';
import { RedisLobbyStoreService } from '../../infrastructure/redis/redis-lobby-store.service';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import {
  LobbyPlayerSlot,
  LobbyRuntime,
  pickFallbackHumanAdminSessionToken,
} from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';

const PLAYER_DISCONNECT_GRACE_MS = 120_000;
const EMPTY_LOBBY_CLEANUP_DELAY_MS = 30_000;
const SUMMARY_ENTRY_DELAY_MS = 15_000;
const SUMMARY_HARD_END_DELAY_MS = 5 * 60_000;

@Injectable()
export class LobbyOrchestratorService {
  private readonly logger = new Logger(LobbyOrchestratorService.name);

  public constructor(
    private readonly lobby: LobbyService,
    private readonly demoBots: DemoBotService,
    private readonly redisLobby: RedisLobbyStoreService,
    private readonly liveKit: LiveKitRoomService,
  ) {}

  public async createLobby(
    lobbyCodeInput: string,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): Promise<{ lobby: LobbyRuntime; joined: LobbyJoinedPayload }> {
    const lobbyCode = lobbyCodeInput.trim();
    if (!isLobbyCodeValid(lobbyCode)) {
      throw new BadRequestException(ActionRejectCode.InvalidPayload);
    }
    const normalizedCode = normalizeLobbyCode(lobbyCode);
    const canonicalLobbyId = await this.redisLobby.createCanonicalLobbyId(lobbyCode);
    if (canonicalLobbyId === null) {
      throw new BadRequestException(ActionRejectCode.LobbyAlreadyExists);
    }
    this.lobby.registerCanonicalIdByLobbyCode(normalizedCode, canonicalLobbyId);
    const lobby = this.lobby.getOrCreateLobby(canonicalLobbyId, normalizedCode);
    await this.liveKit.ensureRoom(canonicalLobbyId);
    return {
      lobby,
      joined: await this.joinLobbyCore(lobby, sessionToken, displayName, socketId),
    };
  }

  public async joinLobby(
    lobbyCodeInput: string,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): Promise<{ lobby: LobbyRuntime; joined: LobbyJoinedPayload }> {
    const lobbyCode = lobbyCodeInput.trim();
    if (!isLobbyCodeValid(lobbyCode)) {
      throw new BadRequestException(ActionRejectCode.InvalidPayload);
    }
    const normalizedCode = normalizeLobbyCode(lobbyCode);
    const canonicalLobbyId = await this.redisLobby.resolveCanonicalLobbyIdByCode(lobbyCode);
    if (canonicalLobbyId === null) {
      throw new BadRequestException(ActionRejectCode.UnknownLobby);
    }
    const priorCanonical = this.lobby.getCanonicalIdByLobbyCode(normalizedCode);
    const lobbyIdleRecycled = priorCanonical !== undefined && priorCanonical !== canonicalLobbyId;
    if (lobbyIdleRecycled) {
      this.lobby.evictLobby(priorCanonical);
      void this.liveKit.deleteRoom(priorCanonical).catch((error: unknown) => {
        this.logger.debug('LiveKit deleteRoom stale failed');
      });
    }
    this.lobby.registerCanonicalIdByLobbyCode(normalizedCode, canonicalLobbyId);
    const lobby = this.lobby.getOrCreateLobby(canonicalLobbyId, normalizedCode);
    await this.redisLobby.refreshLobbyActivity(canonicalLobbyId, normalizedCode);
    await this.liveKit.ensureRoom(canonicalLobbyId);
    const joined = await this.joinLobbyCore(lobby, sessionToken, displayName, socketId);
    if (lobbyIdleRecycled) {
      return { lobby, joined: { ...joined, lobbyIdleRecycled: true } };
    }
    return { lobby, joined };
  }

  public fillLobbyWithBots(lobbyId: string, sessionToken: string): LobbyRuntime {
    const lobby = this.lobby.requireLobby(lobbyId);
    if (lobby.fsm.getPhase() !== GamePhase.LobbyWaiting) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    this.lobby.ensureLobbyAdminConsistent(lobby);
    if (lobby.adminSessionToken !== sessionToken) {
      throw new Error(ActionRejectCode.LobbyHostOnly);
    }
    this.demoBots.fillDemoLobbyWithBots(lobby);
    return lobby;
  }

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
    lobby.clearDisconnectTimer(player);
    player.socketId = client.id;
    player.disconnectGraceExpiresAt = null;
    player.awaitingAdminDecision = false;
    this.lobby.broadcastFullState(server, lobby);
  }

  public onDisconnect(sessionToken: string, server: Server): void {
    const found = this.lobby.findLobbyByPlayerToken(sessionToken);
    if (found === undefined) {
      return;
    }
    const { lobby, player } = found;
    player.socketId = null;
    if (lobby.fsm.getPhase() === GamePhase.LobbyWaiting) {
      void this.removePlayerFromLobby(lobby, player, server, 'disconnect in lobby waiting');
      return;
    }
    player.disconnectGraceExpiresAt = Date.now() + PLAYER_DISCONNECT_GRACE_MS;
    player.awaitingAdminDecision = false;
    lobby.startDisconnectHold(player, PLAYER_DISCONNECT_GRACE_MS, () => {
      this.onDisconnectGraceExpired(lobby, player, server);
    });
    this.lobby.broadcastFullState(server, lobby);
    void this.maybeCloseVideoLobby(lobby);
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

  /**
   * Mutates the disconnected slot into a bot slot in place. Does NOT broadcast —
   * GameService.kickAndReplaceWithBot owns the broadcast + bot-autoplay drain so
   * the new bot actually takes its turn.
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
    lobby.clearDisconnectTimer(target);
    if (wasAdmin) {
      lobby.adminSessionToken = pickFallbackHumanAdminSessionToken(lobby);
    }
    void this.redisLobby.removeMember(lobby.lobbyId, oldSessionToken).catch((error: unknown) => {
      this.logger.debug('Redis removeMember failed');
    });
    this.logger.log(
      `admin ${requesterSessionToken} kicked seat ${seat} (${oldSessionToken}) in ${lobby.lobbyCode}, replaced with bot`,
    );
    return lobby;
  }

  public async leaveLobby(lobbyId: string, sessionToken: string, server: Server): Promise<void> {
    const lobby = this.lobby.getLobby(lobbyId);
    if (!lobby) {
      return;
    }
    if (lobby.fsm.getPhase() !== GamePhase.LobbyWaiting) {
      return;
    }
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      return;
    }
    const socketId = player.socketId;
    if (socketId !== null) {
      void server.in(socketId).socketsLeave(formatSocketIoLobbyRoomId(lobby.lobbyId));
    }
    await this.removePlayerFromLobby(lobby, player, server, 'explicit leave');
  }

  private async removePlayerFromLobby(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    server: Server,
    reason: string,
  ): Promise<void> {
    this.logger.log(`removing ${player.sessionToken} from ${lobby.lobbyCode} (${reason})`);
    const wasAdmin = lobby.adminSessionToken === player.sessionToken;
    await this.redisLobby.removeMember(lobby.lobbyId, player.sessionToken);
    lobby.removePlayer(player.sessionToken);
    if (wasAdmin) {
      lobby.adminSessionToken = pickFallbackHumanAdminSessionToken(lobby);
    }
    this.lobby.broadcastFullState(server, lobby);
    await this.maybeCloseVideoLobby(lobby);
  }

  private async maybeCloseVideoLobby(lobby: LobbyRuntime): Promise<void> {
    if (this.countConnectedHumans(lobby) > 0) {
      lobby.clearEmptyLobbyCleanupTimer();
      return;
    }
    if (lobby.emptyLobbyCleanupTimer !== null || lobby.isTearingDown) {
      return;
    }
    this.logger.log(
      `lobby ${lobby.lobbyCode} has no connected humans, scheduling cleanup in ${EMPTY_LOBBY_CLEANUP_DELAY_MS}ms`,
    );
    lobby.startEmptyLobbyCleanupHold(EMPTY_LOBBY_CLEANUP_DELAY_MS, () => {
      void this.finalizeEmptyLobbyCleanup(lobby);
    });
  }

  private async finalizeEmptyLobbyCleanup(lobby: LobbyRuntime): Promise<void> {
    lobby.emptyLobbyCleanupTimer = null;
    if (this.countConnectedHumans(lobby) > 0) {
      return;
    }
    if (lobby.isTearingDown) {
      return;
    }
    if (this.lobby.getLobby(lobby.lobbyId) !== lobby) {
      return;
    }
    await this.tearDownLobby(lobby, 'no connected humans');
  }

  /**
   * Atomic teardown sequence used by both empty-lobby cleanup and summary hard-end.
   * Order matters: set the flag (joins reject immediately), release the Redis alias
   * (so future joiners get UnknownLobby), then drop in-memory state and LiveKit.
   */
  private async tearDownLobby(lobby: LobbyRuntime, reason: string): Promise<void> {
    if (lobby.isTearingDown) {
      return;
    }
    lobby.isTearingDown = true;
    this.logger.log(`tearing down lobby ${lobby.lobbyCode} (${lobby.lobbyId}): ${reason}`);
    lobby.clearAllDisconnectTimers();
    try {
      await this.redisLobby.deleteLobby(lobby.lobbyId, lobby.lobbyCode);
    } catch (error: unknown) {
      this.logger.debug('Redis deleteLobby failed');
    }
    this.lobby.removeLobby(lobby.lobbyId, lobby.lobbyCode);
    try {
      await this.liveKit.deleteRoom(lobby.lobbyId);
    } catch (error: unknown) {
      this.logger.debug('LiveKit deleteRoom failed');
    }
  }

  /**
   * Called once after every state-changing broadcast. If a winner has just been declared
   * and we haven't queued the Summary transition yet, schedule it. Idempotent.
   */
  public maybeScheduleSummaryEntry(lobby: LobbyRuntime, server: Server): void {
    if (lobby.winnerSeat === null) {
      return;
    }
    if (lobby.fsm.getPhase() !== GamePhase.Finished) {
      return;
    }
    if (lobby.summaryEntryTimer !== null) {
      return;
    }
    this.logger.log(`scheduling Summary entry for ${lobby.lobbyCode} in ${SUMMARY_ENTRY_DELAY_MS}ms`);
    lobby.startSummaryEntryHold(SUMMARY_ENTRY_DELAY_MS, () => {
      this.enterSummary(lobby, server);
    });
  }

  private enterSummary(lobby: LobbyRuntime, server: Server): void {
    lobby.summaryEntryTimer = null;
    if (lobby.fsm.getPhase() !== GamePhase.Finished) {
      return;
    }
    lobby.fsm.onSummaryEntered();
    this.logger.log(
      `lobby ${lobby.lobbyCode} entered Summary; hard end in ${SUMMARY_HARD_END_DELAY_MS}ms`,
    );
    lobby.startSummaryHardEndHold(SUMMARY_HARD_END_DELAY_MS, () => {
      void this.onSummaryHardEnd(lobby, server);
    });
    this.lobby.broadcastFullState(server, lobby);
  }

  private async onSummaryHardEnd(lobby: LobbyRuntime, server: Server): Promise<void> {
    lobby.summaryHardEndTimer = null;
    if (lobby.fsm.getPhase() !== GamePhase.Summary) {
      return;
    }
    const payload: LobbyTerminatedPayload = {
      lobbyId: lobby.lobbyId,
      reason: LobbyTerminationReason.SummaryTimeout,
    };
    server.to(formatSocketIoLobbyRoomId(lobby.lobbyId)).emit(GameSocketServerEvent.LobbyTerminated, payload);
    await this.tearDownLobby(lobby, 'summary hard end');
  }

  private countConnectedHumans(lobby: LobbyRuntime): number {
    let connected = 0;
    for (let i = 0; i < lobby.players.length; i += 1) {
      const p = lobby.players[i];
      if (!p.isBot && p.socketId !== null) {
        connected += 1;
      }
    }
    return connected;
  }

  private async joinLobbyCore(
    lobby: LobbyRuntime,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): Promise<LobbyJoinedPayload> {
    if (lobby.isTearingDown) {
      throw new BadRequestException(ActionRejectCode.LobbyAlreadyExists);
    }
    lobby.clearEmptyLobbyCleanupTimer();
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      let seat: PlayerSeat;
      try {
        seat = lobby.addPlayer(sessionToken, displayName, socketId, false);
        if (lobby.adminSessionToken === null) {
          lobby.adminSessionToken = sessionToken;
        }
      } catch {
        throw new BadRequestException(ActionRejectCode.LobbyFull);
      }
      await this.redisLobby.addMember(lobby.lobbyId, lobby.lobbyCode, {
        sessionToken,
        seat,
        displayName,
        isBot: false,
      });
      const liveKitGrant = await this.liveKit.issueJoinToken({
        roomName: lobby.lobbyId,
        identity: sessionToken,
        displayName,
        seat,
        canPublish: true,
      });
      return {
        lobbyId: lobby.lobbyId,
        lobbyCode: lobby.lobbyCode,
        seat,
        liveKit: {
          serverUrl: liveKitGrant.serverUrl,
          token: liveKitGrant.token,
          roomName: liveKitGrant.roomName,
        },
      };
    }
    lobby.clearDisconnectTimer(player);
    player.socketId = socketId;
    player.disconnectGraceExpiresAt = null;
    player.awaitingAdminDecision = false;
    await this.redisLobby.addMember(lobby.lobbyId, lobby.lobbyCode, {
      sessionToken,
      seat: player.seat,
      displayName: player.displayName,
      isBot: false,
    });
    const liveKitGrant = await this.liveKit.issueJoinToken({
      roomName: lobby.lobbyId,
      identity: sessionToken,
      displayName: player.displayName,
      seat: player.seat,
      canPublish: true,
    });
    return {
      lobbyId: lobby.lobbyId,
      lobbyCode: lobby.lobbyCode,
      seat: player.seat,
      liveKit: {
        serverUrl: liveKitGrant.serverUrl,
        token: liveKitGrant.token,
        roomName: liveKitGrant.roomName,
      },
    };
  }
}
