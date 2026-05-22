import { randomInt } from 'node:crypto';
import {
  ActionRejectCode,
  AxialCoordDto,
  DevCardType,
  DiceRollDto,
  PlayerSeat,
  ResourceType,
} from '@catan/api-interfaces';
import {
  createBoardTopology,
  makeStandardLandPlacements,
  type BoardEdgeRuntime,
  type BoardVertexRuntime,
  type TilePlacement,
} from '@catan/shared-game-field';
import { createShuffledDevDeck } from '../dev-cards/dev-deck.util';
import {
  countResourceCards,
  emptyMutableResourceRecord,
} from '../utils/public-player-resources.util';
import { LobbyTimerRegistry } from './lobby-timer-registry';
import { TurnStateMachine } from '../turn/turn-state-machine';

export const CLOCKWISE_SEATS: readonly PlayerSeat[] = [
  PlayerSeat.North,
  PlayerSeat.East,
  PlayerSeat.South,
  PlayerSeat.West,
];

export function getOccupiedSeatsClockwise(lobby: LobbyRuntime): PlayerSeat[] {
  const occupied: PlayerSeat[] = [];
  for (let i = 0; i < CLOCKWISE_SEATS.length; i += 1) {
    const seat = CLOCKWISE_SEATS[i];
    const player = lobby.findPlayerBySeat(seat);
    if (!player) {
      continue;
    }
    occupied.push(seat);
  }
  return occupied;
}

export function pickFallbackHumanAdminSessionToken(lobby: LobbyRuntime): string | null {
  for (let i = 0; i < lobby.players.length; i += 1) {
    const candidate = lobby.players[i];
    if (!candidate.isBot) {
      return candidate.sessionToken;
    }
  }
  return null;
}

export interface LobbyPlayerSlot {
  sessionToken: string;
  displayName: string;
  isBot: boolean;
  seat: PlayerSeat;
  socketId: string | null;
  resources: Record<ResourceType, number>;
  devCards: DevCardType[];
  devCardsBoughtThisTurn: DevCardType[];
  hasPlayedDevCardThisTurn: boolean;
  playedKnights: number;
  visibleVictoryPoints: number;
  longestRoadLength: number;
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  disconnectTimer: NodeJS.Timeout | null;
  /** Epoch ms when the grace timer expires, null if connected or already past grace. */
  disconnectGraceExpiresAt: number | null;
  /** True after grace expired without reconnect — waits for admin to kick (Bot) or wait longer. */
  awaitingAdminDecision: boolean;
}

export interface LobbySettlementSlot {
  seat: PlayerSeat;
  vertexId: string;
  isCity: boolean;
}

export interface LobbyRoadSlot {
  seat: PlayerSeat;
  edgeId: string;
}

export class LobbyRuntime {
  public readonly lobbyId: string;
  public readonly lobbyCode: string;
  public readonly seed: number;
  public readonly tiles: readonly TilePlacement[];
  public readonly fsm: TurnStateMachine = new TurnStateMachine();
  public currentSeat: PlayerSeat = PlayerSeat.North;
  public adminSessionToken: string | null = null;
  public readonly players: LobbyPlayerSlot[] = [];
  public readonly settlements: LobbySettlementSlot[] = [];
  public readonly roads: LobbyRoadSlot[] = [];
  public robberCoord: AxialCoordDto;
  public pendingRobberDiscardSeats: PlayerSeat[] = [];
  public lastDiceRoll: DiceRollDto | null = null;
  public setupPlacementsBySeat: Record<PlayerSeat, number>;
  public pendingSetupRoadSeat: PlayerSeat | null = null;
  public pendingSetupRoadFromVertexId: string | null = null;
  public pendingSetupResourceSeat: PlayerSeat | null = null;
  public pendingSetupResourceFromVertexId: string | null = null;
  public readonly verticesById: Map<string, BoardVertexRuntime>;
  public readonly edgesById: Map<string, BoardEdgeRuntime>;
  public readonly devDeck: DevCardType[];
  public longestRoadSeat: PlayerSeat | null = null;
  public largestArmySeat: PlayerSeat | null = null;
  public winnerSeat: PlayerSeat | null = null;
  public readonly timers: LobbyTimerRegistry = new LobbyTimerRegistry();
  /** True while finalizeEmptyLobbyCleanup / forceTerminate is mid-flight — joins reject as LobbyAlreadyExists. */
  public isTearingDown = false;

  public constructor(lobbyId: string, lobbyCode: string) {
    this.lobbyId = lobbyId;
    this.lobbyCode = lobbyCode;
    this.seed = randomInt(0, 0xffffffff);
    this.tiles = makeStandardLandPlacements(this.seed);
    const topology = createBoardTopology(this.tiles);
    this.verticesById = topology.verticesById;
    this.edgesById = topology.edgesById;
    const desert = this.tiles.find((tile) => tile.number === null);
    this.robberCoord = desert ? { q: desert.coord.q, r: desert.coord.r } : { q: 0, r: 0 };
    this.setupPlacementsBySeat = this.createSeatCounter();
    this.devDeck = createShuffledDevDeck();
  }

  public findPlayerBySeat(seat: PlayerSeat): LobbyPlayerSlot | undefined {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].seat === seat) {
        return this.players[i];
      }
    }
    return undefined;
  }

  public findPlayerByToken(sessionToken: string): LobbyPlayerSlot | undefined {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].sessionToken === sessionToken) {
        return this.players[i];
      }
    }
    return undefined;
  }

  public findPlayerBySocketId(socketId: string): LobbyPlayerSlot | undefined {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].socketId === socketId) {
        return this.players[i];
      }
    }
    return undefined;
  }

  public nextFreeSeat(): PlayerSeat | undefined {
    for (let s = 0; s < CLOCKWISE_SEATS.length; s += 1) {
      const seat = CLOCKWISE_SEATS[s];
      let taken = false;
      for (let p = 0; p < this.players.length; p++) {
        if (this.players[p].seat === seat) {
          taken = true;
          break;
        }
      }
      if (!taken) {
        return seat;
      }
    }
    return undefined;
  }


  public removePlayer(sessionToken: string): void {
    for (let i = 0; i < this.players.length; i += 1) {
      if (this.players[i].sessionToken === sessionToken) {
        this.timers.clearDisconnectTimer(this.players[i]);
        this.players.splice(i, 1);
        return;
      }
    }
  }

  public addPlayer(
    sessionToken: string,
    displayName: string,
    socketId: string | null,
    isBot: boolean,
  ): PlayerSeat {
    const seat = this.nextFreeSeat();
    if (seat === undefined) {
      throw new Error(ActionRejectCode.LobbyFull);
    }
    const resources = emptyMutableResourceRecord();
    this.players.push({
      sessionToken,
      displayName,
      isBot,
      seat,
      socketId,
      resources,
      devCards: [],
      devCardsBoughtThisTurn: [],
      hasPlayedDevCardThisTurn: false,
      playedKnights: 0,
      visibleVictoryPoints: 0,
      longestRoadLength: 0,
      hasLongestRoad: false,
      hasLargestArmy: false,
      disconnectTimer: null,
      disconnectGraceExpiresAt: null,
      awaitingAdminDecision: false,
    });
    return seat;
  }

  public setPlayerSocket(sessionToken: string, socketId: string): void {
    const player = this.findPlayerByToken(sessionToken);
    if (player) {
      player.socketId = socketId;
    }
  }

  public clearAllDisconnectTimers(): void {
    this.timers.clearAll(this.players);
  }

  public requiredRobberDiscardCount(player: LobbyPlayerSlot): number {
    const total = countResourceCards(player);
    if (total <= 7) {
      return 0;
    }
    return Math.floor(total / 2);
  }

  public createSeatCounter(initialValue = 0): Record<PlayerSeat, number> {
    return {
      [PlayerSeat.North]: initialValue,
      [PlayerSeat.East]: initialValue,
      [PlayerSeat.South]: initialValue,
      [PlayerSeat.West]: initialValue,
    };
  }
}
