import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ActionRejectCode,
  formatSocketIoLobbyRoomId,
  GamePhase,
  isLobbyCodeValid,
  normalizeLobbyCode,
  PlayerSeat,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { LiveKitRoomService } from '../../infrastructure/livekit/livekit-room.service';
import { RedisLobbyStoreService } from '../../infrastructure/redis/redis-lobby-store.service';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import {
  LobbyPlayerSlot,
  LobbyRuntime,
  pickFallbackHumanAdminSessionToken,
} from '../lobby/lobby-runtime';
import { LobbyService } from '../lobby/lobby.service';

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
    const lobbyIdleRecycled =
      priorCanonical !== undefined && priorCanonical !== canonicalLobbyId;
    if (lobbyIdleRecycled) {
      this.lobby.evictLobby(priorCanonical);
      void this.liveKit.deleteRoom(priorCanonical).catch((error: unknown) => {
        this.logger.warn(`LiveKit deleteRoom stale ${priorCanonical}: ${String(error)}`);
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

  public fillLobbyWithBots(lobbyId: string, sessionToken: string, server: Server): void {
    const lobby = this.lobby.requireLobby(lobbyId);
    if (lobby.fsm.getPhase() !== GamePhase.LobbyWaiting) {
      throw new Error(ActionRejectCode.WrongPhase);
    }
    this.lobby.ensureLobbyAdminConsistent(lobby);
    if (lobby.adminSessionToken !== sessionToken) {
      throw new Error(ActionRejectCode.LobbyHostOnly);
    }
    this.demoBots.fillDemoLobbyWithBots(lobby);
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
    lobby.startDisconnectHold(player, 60_000, () => {
      void this.removePlayerFromLobby(lobby, player, server, 'grace period ended');
    });
    this.lobby.broadcastFullState(server, lobby);
  }

  public async leaveLobby(
    lobbyId: string,
    sessionToken: string,
    server: Server,
  ): Promise<void> {
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
    let humans = 0;
    for (let i = 0; i < lobby.players.length; i += 1) {
      if (!lobby.players[i].isBot) {
        humans += 1;
      }
    }
    if (humans > 0) {
      return;
    }
    this.lobby.removeLobby(lobby.lobbyId, lobby.lobbyCode);
    const redisHumans = await this.redisLobby.listHumanMembers(lobby.lobbyId);
    if (redisHumans.length > 0) {
      return;
    }
    await this.liveKit.deleteRoom(lobby.lobbyId);
    await this.redisLobby.deleteLobby(lobby.lobbyId, lobby.lobbyCode);
  }

  private async joinLobbyCore(
    lobby: LobbyRuntime,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): Promise<LobbyJoinedPayload> {
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
