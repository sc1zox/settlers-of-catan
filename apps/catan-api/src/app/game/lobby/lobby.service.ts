import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ActionRejectCode,
  GameSocketServerEvent,
  isCanonicalLobbyId,
  isLobbyCodeValid,
  KnownLobbyId,
  normalizeLobbyCode,
  PlayerSeat,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { LiveKitRoomService } from '../../infrastructure/livekit/livekit-room.service';
import { RedisLobbyStoreService } from '../../infrastructure/redis/redis-lobby-store.service';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { LobbyPlayerSlot, LobbyRuntime } from './lobby-runtime';
import { resolveHarborRates } from '../utils/harbor-rate.util';
import { getTotalVictoryPoints } from '../utils/scoring.util';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private readonly lobbies = new Map<string, LobbyRuntime>();
  private readonly canonicalIdByLobbyCode = new Map<string, string>();

  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly demoBots: DemoBotService,
    private readonly redisLobby: RedisLobbyStoreService,
    private readonly liveKit: LiveKitRoomService,
  ) {}

  public getOrCreateLobby(canonicalLobbyId: string, lobbyCode: string): LobbyRuntime {
    let lobby = this.lobbies.get(canonicalLobbyId);
    if (!lobby) {
      lobby = new LobbyRuntime(canonicalLobbyId, lobbyCode);
      this.lobbies.set(canonicalLobbyId, lobby);
      this.canonicalIdByLobbyCode.set(normalizeLobbyCode(lobbyCode), canonicalLobbyId);
    }
    return lobby;
  }

  public getLobby(lobbyKey: string): LobbyRuntime | undefined {
    const canonicalId = this.resolveCanonicalLobbyIdFromMemory(lobbyKey);
    if (canonicalId === null) {
      return undefined;
    }
    return this.lobbies.get(canonicalId);
  }

  public requireLobby(lobbyKey: string): LobbyRuntime {
    const lobby = this.getLobby(lobbyKey);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    return lobby;
  }

  public assertLobbyOpen(lobby: LobbyRuntime): void {
    if (lobby.fsm.isFinished()) {
      throw new Error(ActionRejectCode.GameFinished);
    }
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
    const canonicalLobbyId = await this.redisLobby.resolveOrCreateCanonicalLobbyId(lobbyCode);
    const normalizedCode = normalizeLobbyCode(lobbyCode);
    this.canonicalIdByLobbyCode.set(normalizedCode, canonicalLobbyId);
    const lobby = this.getOrCreateLobby(canonicalLobbyId, normalizedCode);
    await this.liveKit.ensureRoom(canonicalLobbyId);
    this.demoBots.pruneDemoLobbyStaleHumans(lobby, sessionToken);
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      let seat: PlayerSeat;
      try {
        seat = lobby.addPlayer(sessionToken, displayName, socketId, false);
        if (lobby.adminSessionToken === null) {
          lobby.adminSessionToken = sessionToken;
        }
        this.demoBots.fillDemoLobbyWithBots(lobby);
      } catch {
        throw new BadRequestException(ActionRejectCode.LobbyFull);
      }
      await this.redisLobby.addMember(canonicalLobbyId, {
        sessionToken,
        seat,
        displayName,
        isBot: false,
      });
      const liveKitGrant = await this.liveKit.issueJoinToken({
        roomName: canonicalLobbyId,
        identity: sessionToken,
        displayName,
        seat,
        canPublish: true,
      });
      return {
        lobby,
        joined: {
          lobbyId: canonicalLobbyId,
          lobbyCode: normalizedCode,
          seat,
          liveKit: {
            serverUrl: liveKitGrant.serverUrl,
            token: liveKitGrant.token,
            roomName: liveKitGrant.roomName,
          },
        },
      };
    }
    lobby.clearDisconnectTimer(player);
    player.socketId = socketId;
    this.demoBots.fillDemoLobbyWithBots(lobby);
    await this.redisLobby.addMember(canonicalLobbyId, {
      sessionToken,
      seat: player.seat,
      displayName: player.displayName,
      isBot: false,
    });
    const liveKitGrant = await this.liveKit.issueJoinToken({
      roomName: canonicalLobbyId,
      identity: sessionToken,
      displayName: player.displayName,
      seat: player.seat,
      canPublish: true,
    });
    return {
      lobby,
      joined: {
        lobbyId: canonicalLobbyId,
        lobbyCode: normalizedCode,
        seat: player.seat,
        liveKit: {
          serverUrl: liveKitGrant.serverUrl,
          token: liveKitGrant.token,
          roomName: liveKitGrant.roomName,
        },
      },
    };
  }

  public onDisconnect(sessionToken: string, server: Server): void {
    for (const lobby of this.lobbies.values()) {
      const player = lobby.findPlayerByToken(sessionToken);
      if (!player) {
        continue;
      }
      player.socketId = null;
      lobby.startDisconnectHold(player, 60_000, () => {
        void this.handleDisconnectGraceEnded(lobby, player, server);
      });
      this.broadcastFullState(server, lobby);
      return;
    }
  }

  private async handleDisconnectGraceEnded(
    lobby: LobbyRuntime,
    player: LobbyPlayerSlot,
    server: Server,
  ): Promise<void> {
    this.logger.warn(`grace period ended for ${player.sessionToken} in ${lobby.lobbyCode}`);
    await this.redisLobby.removeMember(lobby.lobbyId, player.sessionToken);
    lobby.removePlayer(player.sessionToken);
    this.broadcastFullState(server, lobby);
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
    this.lobbies.delete(lobby.lobbyId);
    this.canonicalIdByLobbyCode.delete(lobby.lobbyCode);
    const redisHumans = await this.redisLobby.listHumanMembers(lobby.lobbyId);
    if (redisHumans.length > 0) {
      return;
    }
    await this.liveKit.deleteRoom(lobby.lobbyId);
    await this.redisLobby.deleteLobby(lobby.lobbyId, lobby.lobbyCode);
  }

  public toFullState(lobby: LobbyRuntime, viewerSessionToken: string): LobbyFullStatePayload {
    const players = lobby.players.map((p) => ({
      seat: p.seat,
      displayName: p.displayName,
      isBot: p.isBot,
      isConnected: p.socketId !== null,
      isSelf: p.sessionToken === viewerSessionToken,
      resources: { ...p.resources },
      devCardsInHand: p.devCards.length,
      devCardsBoughtThisTurn: p.devCardsBoughtThisTurn.length,
      hasPlayedDevCardThisTurn: p.hasPlayedDevCardThisTurn,
      playedKnights: p.playedKnights,
      visibleVictoryPoints: p.visibleVictoryPoints,
      totalVictoryPoints: getTotalVictoryPoints(p),
      longestRoadLength: p.longestRoadLength,
      harborRates: resolveHarborRates(lobby, p.seat),
    }));
    const viewer = lobby.findPlayerByToken(viewerSessionToken);
    const legalMoves = viewer
      ? this.validation.computeLegalMoves(lobby, viewer.seat)
      : { settlements: [], roads: [], cities: [], roadBuilding: [] };
    return {
      lobbyId: lobby.lobbyId,
      lobbyCode: lobby.lobbyCode,
      phase: lobby.fsm.getPhase(),
      currentSeat: lobby.currentSeat,
      adminSeat: this.resolveAdminSeat(lobby),
      seed: lobby.seed,
      tiles: lobby.tiles,
      vertexIds: Array.from(lobby.verticesById.keys()),
      edgeIds: Array.from(lobby.edgesById.keys()),
      legalSettlementVertexIds: legalMoves.settlements,
      legalRoadEdgeIds: legalMoves.roads,
      legalCityVertexIds: legalMoves.cities,
      legalRoadBuildingEdgeIds: legalMoves.roadBuilding,
      settlements: lobby.settlements.map((settlement) => ({ ...settlement })),
      roads: lobby.roads.map((road) => ({ ...road })),
      robberCoord: { ...lobby.robberCoord },
      pendingRobberDiscardSeats: lobby.pendingRobberDiscardSeats.slice(),
      pendingSetupRoadSeat: lobby.pendingSetupRoadSeat,
      pendingSetupRoadFromVertexId: lobby.pendingSetupRoadFromVertexId,
      lastDiceRoll: lobby.lastDiceRoll ? { ...lobby.lastDiceRoll } : null,
      longestRoadSeat: lobby.longestRoadSeat,
      largestArmySeat: lobby.largestArmySeat,
      winnerSeat: lobby.winnerSeat,
      devDeckCount: lobby.devDeck.length,
      players,
    };
  }

  public broadcastFullState(server: Server, lobby: LobbyRuntime): void {
    for (let i = 0; i < lobby.players.length; i += 1) {
      const p = lobby.players[i];
      if (p.socketId) {
        server
          .to(p.socketId)
          .emit(GameSocketServerEvent.FullState, this.toFullState(lobby, p.sessionToken));
      }
    }
  }

  private resolveCanonicalLobbyIdFromMemory(lobbyKey: string): string | null {
    const trimmed = lobbyKey.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (this.lobbies.has(trimmed)) {
      return trimmed;
    }
    const byCode = this.canonicalIdByLobbyCode.get(normalizeLobbyCode(trimmed));
    if (byCode !== undefined) {
      return byCode;
    }
    if (isCanonicalLobbyId(trimmed)) {
      return trimmed;
    }
    return null;
  }

  private resolveAdminSeat(lobby: LobbyRuntime): PlayerSeat {
    const adminToken = lobby.adminSessionToken;
    if (adminToken !== null) {
      const adminPlayer = lobby.findPlayerByToken(adminToken);
      if (adminPlayer) {
        return adminPlayer.seat;
      }
    }
    return PlayerSeat.North;
  }
}
