import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ActionRejectCode,
  GameSocketServerEvent,
  PlayerSeat,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { DemoBotService } from '../demo-bot/demo-bot.service';
import { GameActionValidationService } from '../validation/game-action-validation.service';
import { LobbyRuntime } from './lobby-runtime';
import { resolveHarborRates } from '../utils/harbor-rate.util';
import { getTotalVictoryPoints } from '../utils/scoring.util';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private readonly lobbies = new Map<string, LobbyRuntime>();

  public constructor(
    private readonly validation: GameActionValidationService,
    private readonly demoBots: DemoBotService,
  ) {}

  public getOrCreateLobby(lobbyId: string): LobbyRuntime {
    let lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      lobby = new LobbyRuntime(lobbyId);
      this.lobbies.set(lobbyId, lobby);
    }
    return lobby;
  }

  public getLobby(lobbyId: string): LobbyRuntime | undefined {
    return this.lobbies.get(lobbyId);
  }

  public requireLobby(lobbyId: string): LobbyRuntime {
    const lobby = this.lobbies.get(lobbyId);
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

  public joinLobby(
    lobbyId: string,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): { lobby: LobbyRuntime; joined: LobbyJoinedPayload } {
    const lobby = this.getOrCreateLobby(lobbyId);
    this.demoBots.pruneDemoLobbyStaleHumans(lobby, sessionToken);
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      let seat;
      try {
        seat = lobby.addPlayer(sessionToken, displayName, socketId, false);
        if (lobby.adminSessionToken === null) {
          lobby.adminSessionToken = sessionToken;
        }
        this.demoBots.fillDemoLobbyWithBots(lobby);
      } catch {
        throw new BadRequestException(ActionRejectCode.LobbyFull);
      }
      return {
        lobby,
        joined: { lobbyId, seat },
      };
    }
    lobby.clearDisconnectTimer(player);
    player.socketId = socketId;
    this.demoBots.fillDemoLobbyWithBots(lobby);
    return {
      lobby,
      joined: { lobbyId, seat: player.seat },
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
        this.logger.warn(`grace period ended for ${sessionToken} in ${lobby.lobbyId}`);
      });
      this.broadcastFullState(server, lobby);
      return;
    }
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
    for (let i = 0; i < lobby.players.length; i++) {
      const p = lobby.players[i];
      if (p.socketId) {
        server
          .to(p.socketId)
          .emit(GameSocketServerEvent.FullState, this.toFullState(lobby, p.sessionToken));
      }
    }
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
