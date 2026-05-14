import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ActionRejectCode,
  GameDeltaType,
  GamePhase,
  GameSocketServerEvent,
  type GameDeltaPayload,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { Server } from 'socket.io';
import { GameActionValidationService } from './game-action-validation.service';
import { LobbyRuntime } from './lobby-runtime';

export function lobbyRoomName(lobbyId: string): string {
  return `lobby:${lobbyId}`;
}

function asRejectCode(message: string): ActionRejectCode {
  const values = Object.values(ActionRejectCode) as string[];
  for (let i = 0; i < values.length; i++) {
    if (values[i] === message) {
      return message as ActionRejectCode;
    }
  }
  return ActionRejectCode.WrongPhase;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly lobbies = new Map<string, LobbyRuntime>();

  public constructor(private readonly validation: GameActionValidationService) {}

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

  public joinLobby(
    lobbyId: string,
    sessionToken: string,
    displayName: string,
    socketId: string,
  ): { lobby: LobbyRuntime; joined: LobbyJoinedPayload } {
    const lobby = this.getOrCreateLobby(lobbyId);
    const player = lobby.findPlayerByToken(sessionToken);
    if (!player) {
      let seat;
      try {
        seat = lobby.addPlayer(sessionToken, displayName, socketId);
      } catch {
        throw new BadRequestException(ActionRejectCode.LobbyFull);
      }
      lobby.fsm.setPhase(GamePhase.Building);
      return {
        lobby,
        joined: { lobbyId, seat },
      };
    }
    lobby.clearDisconnectTimer(player);
    player.socketId = socketId;
    lobby.fsm.setPhase(GamePhase.Building);
    return {
      lobby,
      joined: { lobbyId, seat: player.seat },
    };
  }

  public toFullState(lobby: LobbyRuntime, viewerSessionToken: string): LobbyFullStatePayload {
    const players = lobby.players.map((p) => ({
      seat: p.seat,
      displayName: p.displayName,
      isConnected: p.socketId !== null,
      isSelf: p.sessionToken === viewerSessionToken,
      resources: { ...p.resources },
    }));
    return {
      lobbyId: lobby.lobbyId,
      phase: lobby.fsm.getPhase(),
      currentSeat: lobby.currentSeat,
      seed: lobby.seed,
      tiles: lobby.tiles,
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

  public buildSettlement(
    lobbyId: string,
    sessionToken: string,
    q: number,
    r: number,
    server: Server,
  ): GameDeltaPayload {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      throw new Error(ActionRejectCode.UnknownLobby);
    }
    this.validation.assertPhase(lobby, [GamePhase.Building]);
    const player = this.validation.assertCurrentPlayer(lobby, sessionToken);
    this.validation.assertSettlementCost(player);
    this.validation.assertLegalSettlementCoord(lobby, q, r);
    this.validation.deductSettlementCost(player);
    const delta: GameDeltaPayload = {
      type: GameDeltaType.SettlementBuilt,
      seat: player.seat,
      q,
      r,
    };
    server.to(lobbyRoomName(lobbyId)).emit(GameSocketServerEvent.GameDelta, delta);
    this.broadcastFullState(server, lobby);
    return delta;
  }

  public describeError(e: unknown): { code: ActionRejectCode; message: string } {
    if (e instanceof BadRequestException) {
      const response = e.getResponse();
      const message = typeof response === 'string' ? response : JSON.stringify(response);
      return { code: asRejectCode(message), message };
    }
    if (e instanceof Error) {
      return { code: asRejectCode(e.message), message: e.message };
    }
    return { code: ActionRejectCode.WrongPhase, message: 'unknown_error' };
  }
}
