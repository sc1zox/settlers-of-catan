import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ActionRejectCode,
  formatSocketIoLobbyRoomId,
  GamePhase,
  GameSocketServerEvent,
  isLobbyCodeValid,
  LobbyTerminationReason,
  normalizeLobbyCode,
  type LobbyJoinedPayload,
  type LobbyTerminatedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { LiveKitRoomService } from '../../infrastructure/livekit/livekit-room.service';
import { RedisLobbyStoreService } from '../../infrastructure/redis/redis-lobby-store.service';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';
import { ReconnectService } from '../reconnect/reconnect.service';

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
    private readonly reconnect: ReconnectService,
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
      void this.liveKit.deleteRoom(priorCanonical).catch((_error: unknown) => {
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
    await this.lobby.removePlayerFromLobby(lobby, player, server, 'explicit leave');
    await this.reconnect.maybeCloseVideoLobby(lobby);
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
    await this.lobby.tearDownLobby(lobby, 'summary hard end');
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
      let seat;
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
