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
  /** Last seat we emitted a Longest-Road `BonusAwarded` for — used to detect transitions. */
  public lastAnnouncedLongestRoadSeat: PlayerSeat | null = null;
  /** Last seat we emitted a Largest-Army `BonusAwarded` for — used to detect transitions. */
  public lastAnnouncedLargestArmySeat: PlayerSeat | null = null;
  public winnerSeat: PlayerSeat | null = null;
  /** Pending teardown after the last connected human left. Cleared if anyone (re)joins in time. */
  public emptyLobbyCleanupTimer: NodeJS.Timeout | null = null;
  /** Pending Finished → Summary transition (15s after winner). */
  public summaryEntryTimer: NodeJS.Timeout | null = null;
  /** Pending hard end-of-summary teardown (5min after Summary started). */
  public summaryHardEndTimer: NodeJS.Timeout | null = null;
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

  public emptyResourceBag(): Record<ResourceType, number> {
    return {
      [ResourceType.Wood]: 0,
      [ResourceType.Brick]: 0,
      [ResourceType.Wheat]: 0,
      [ResourceType.Wool]: 0,
      [ResourceType.Ore]: 0,
    };
  }

  public removePlayer(sessionToken: string): void {
    for (let i = 0; i < this.players.length; i += 1) {
      if (this.players[i].sessionToken === sessionToken) {
        this.clearDisconnectTimer(this.players[i]);
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
    const resources = this.emptyResourceBag();
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

  public clearDisconnectTimer(player: LobbyPlayerSlot): void {
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
  }

  public clearAllDisconnectTimers(): void {
    for (let i = 0; i < this.players.length; i += 1) {
      this.clearDisconnectTimer(this.players[i]);
    }
    this.clearEmptyLobbyCleanupTimer();
    this.clearSummaryEntryTimer();
    this.clearSummaryHardEndTimer();
  }

  public startDisconnectHold(player: LobbyPlayerSlot, delayMs: number, onExpire: () => void): void {
    this.clearDisconnectTimer(player);
    player.disconnectTimer = setTimeout(onExpire, delayMs);
  }

  public clearEmptyLobbyCleanupTimer(): void {
    if (this.emptyLobbyCleanupTimer) {
      clearTimeout(this.emptyLobbyCleanupTimer);
      this.emptyLobbyCleanupTimer = null;
    }
  }

  public startEmptyLobbyCleanupHold(delayMs: number, onExpire: () => void): void {
    this.clearEmptyLobbyCleanupTimer();
    this.emptyLobbyCleanupTimer = setTimeout(onExpire, delayMs);
  }

  public clearSummaryEntryTimer(): void {
    if (this.summaryEntryTimer) {
      clearTimeout(this.summaryEntryTimer);
      this.summaryEntryTimer = null;
    }
  }

  public startSummaryEntryHold(delayMs: number, onExpire: () => void): void {
    this.clearSummaryEntryTimer();
    this.summaryEntryTimer = setTimeout(onExpire, delayMs);
  }

  public clearSummaryHardEndTimer(): void {
    if (this.summaryHardEndTimer) {
      clearTimeout(this.summaryHardEndTimer);
      this.summaryHardEndTimer = null;
    }
  }

  public startSummaryHardEndHold(delayMs: number, onExpire: () => void): void {
    this.clearSummaryHardEndTimer();
    this.summaryHardEndTimer = setTimeout(onExpire, delayMs);
  }

  public countTotalResources(player: LobbyPlayerSlot): number {
    let total = 0;
    const keys = Object.values(ResourceType);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      total += player.resources[key] ?? 0;
    }
    return total;
  }

  public requiredRobberDiscardCount(player: LobbyPlayerSlot): number {
    const total = this.countTotalResources(player);
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
