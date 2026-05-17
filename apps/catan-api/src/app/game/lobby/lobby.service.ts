import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRejectCode,
  BonusAwardKind,
  formatSocketIoLobbyRoomId,
  GameSocketServerEvent,
  isCanonicalLobbyId,
  normalizeLobbyCode,
  PlayerSeat,
  type BonusAwardedPayload,
  type LobbyFullStatePayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { RedisLobbyStoreService } from '../../infrastructure/redis/redis-lobby-store.service';
import { TradeService } from '../trade/trade.service';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { LobbyPlayerSlot, LobbyRuntime, pickFallbackHumanAdminSessionToken } from './lobby-runtime';
import { resolveHarborRates } from '../utils/harbor-rate.util';
import { getTotalVictoryPoints } from '../utils/scoring.util';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private readonly lobbies = new Map<string, LobbyRuntime>();
  private readonly canonicalIdByLobbyCode = new Map<string, string>();

  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly redisLobby: RedisLobbyStoreService,
    private readonly trades: TradeService,
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

  public getCanonicalIdByLobbyCode(normalizedCode: string): string | undefined {
    return this.canonicalIdByLobbyCode.get(normalizedCode);
  }

  public registerCanonicalIdByLobbyCode(normalizedCode: string, canonicalLobbyId: string): void {
    this.canonicalIdByLobbyCode.set(normalizedCode, canonicalLobbyId);
  }

  public evictLobby(canonicalLobbyId: string): void {
    const lobby = this.lobbies.get(canonicalLobbyId);
    if (lobby === undefined) {
      return;
    }
    lobby.clearAllDisconnectTimers();
    this.lobbies.delete(canonicalLobbyId);
  }

  public removeLobby(canonicalLobbyId: string, lobbyCode: string): void {
    this.lobbies.delete(canonicalLobbyId);
    this.canonicalIdByLobbyCode.delete(lobbyCode);
  }

  public findLobbyByPlayerToken(
    sessionToken: string,
  ): { lobby: LobbyRuntime; player: LobbyPlayerSlot } | undefined {
    for (const lobby of this.lobbies.values()) {
      const player = lobby.findPlayerByToken(sessionToken);
      if (player !== undefined) {
        return { lobby, player };
      }
    }
    return undefined;
  }

  public toFullState(lobby: LobbyRuntime, viewerSessionToken: string): LobbyFullStatePayload {
    this.ensureLobbyAdminConsistent(lobby);
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
      activeTrades: this.trades.findOpenOffersForLobby(lobby.lobbyId),
    };
  }

  public broadcastFullState(server: Server, lobby: LobbyRuntime): void {
    this.announceBonusAwardTransitions(server, lobby);
    for (let i = 0; i < lobby.players.length; i += 1) {
      const p = lobby.players[i];
      if (p.socketId) {
        server
          .to(p.socketId)
          .emit(GameSocketServerEvent.FullState, this.toFullState(lobby, p.sessionToken));
      }
    }
    if (!this.nonBotLobbyMembersHaveSockets(lobby)) {
      return;
    }
    void this.redisLobby
      .refreshLobbyActivity(lobby.lobbyId, lobby.lobbyCode)
      .catch((error: unknown) => {
        this.logger.warn(`refreshLobbyActivity failed (${lobby.lobbyCode}): ${String(error)}`);
      });
  }

  public ensureLobbyAdminConsistent(lobby: LobbyRuntime): void {
    const token = lobby.adminSessionToken;
    if (token !== null && lobby.findPlayerByToken(token) !== undefined) {
      return;
    }
    lobby.adminSessionToken = pickFallbackHumanAdminSessionToken(lobby);
  }

  /**
   * Emit a `BonusAwarded` to the lobby room exactly once per transition to a
   * new recipient. Losing a bonus (seat going to `null`) is silent — the next
   * FullState already shrinks the holder list, so no fanfare animation is
   * needed for that case.
   */
  private announceBonusAwardTransitions(server: Server, lobby: LobbyRuntime): void {
    const room = formatSocketIoLobbyRoomId(lobby.lobbyId);
    if (
      lobby.longestRoadSeat !== null &&
      lobby.longestRoadSeat !== lobby.lastAnnouncedLongestRoadSeat
    ) {
      const payload: BonusAwardedPayload = {
        lobbyId: lobby.lobbyId,
        kind: BonusAwardKind.LongestRoad,
        recipientSeat: lobby.longestRoadSeat,
      };
      server.to(room).emit(GameSocketServerEvent.BonusAwarded, payload);
    }
    lobby.lastAnnouncedLongestRoadSeat = lobby.longestRoadSeat;
    if (
      lobby.largestArmySeat !== null &&
      lobby.largestArmySeat !== lobby.lastAnnouncedLargestArmySeat
    ) {
      const payload: BonusAwardedPayload = {
        lobbyId: lobby.lobbyId,
        kind: BonusAwardKind.LargestArmy,
        recipientSeat: lobby.largestArmySeat,
      };
      server.to(room).emit(GameSocketServerEvent.BonusAwarded, payload);
    }
    lobby.lastAnnouncedLargestArmySeat = lobby.largestArmySeat;
  }

  private nonBotLobbyMembersHaveSockets(lobby: LobbyRuntime): boolean {
    for (let i = 0; i < lobby.players.length; i += 1) {
      const p = lobby.players[i];
      if (!p.isBot && p.socketId !== null && p.socketId.length > 0) {
        return true;
      }
    }
    return false;
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
