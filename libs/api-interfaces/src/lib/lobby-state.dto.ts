import type { TilePlacement } from '@catan/shared-game-field';
import { DevCardType } from './dev-card-type.enum';
import { GamePhase } from './game-phase.enum';
import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';
import { AxialCoordDto, DiceRollDto } from './turn-flow.dto';

export interface HarborVertexSet {
  readonly vertexIds: readonly string[];
  readonly resource: ResourceType | null;
  readonly ratio: number;
}

export interface PlayerHarborRatesDto {
  /** Best generic (3:1 or 4:1) rate available to this player. */
  readonly generic: number;
  /** Effective per-resource rate (already collapses generic via min). */
  readonly perResource: Readonly<Record<ResourceType, number>>;
}

export interface PlayerRemainingPiecesDto {
  readonly roads: number;
  readonly settlements: number;
  readonly cities: number;
}

export interface LobbyPlayerPublicDto {
  readonly seat: PlayerSeat;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly isConnected: boolean;
  readonly isSelf: boolean;
  /** Exact resource bag; only meaningful for `isSelf` (opponents receive an empty map). */
  readonly resources: Readonly<Record<ResourceType, number>>;
  /** Total resource cards in hand (always set; used for opponents when `resources` is hidden). */
  readonly totalResourceCards: number;
  readonly devCardsInHand: number;
  readonly devCardsBoughtThisTurn: number;
  readonly hasPlayedDevCardThisTurn: boolean;
  readonly playedKnights: number;
  readonly visibleVictoryPoints: number;
  /**
   * For `isSelf`: full VP total (settlements + cities + VP dev cards + Longest Road/Largest Army bonuses).
   * For opponents: publicly visible total only (settlements + cities + known bonuses — VP dev cards excluded).
   */
  readonly totalVictoryPoints: number;
  readonly longestRoadLength: number;
  readonly harborRates: PlayerHarborRatesDto;
  readonly remainingPieces: PlayerRemainingPiecesDto;
  /** Epoch ms when the reconnect grace expires; null means connected or already past grace. */
  readonly disconnectGraceExpiresAt: number | null;
  /** True after grace expired without reconnect — admin may kick & replace with a bot. */
  readonly awaitingAdminDecision: boolean;
}

export interface LobbySettlementDto {
  readonly seat: PlayerSeat;
  readonly vertexId: string;
  readonly isCity: boolean;
}

export interface LobbyRoadDto {
  readonly seat: PlayerSeat;
  readonly edgeId: string;
}

export interface LobbyFullStatePayload {
  /** Canonical id (UUID) used for LiveKit, Redis, and socket action payloads after join. */
  readonly lobbyId: string;
  /** Human-entered lobby code (e.g. "XYZ"). */
  readonly lobbyCode: string;
  readonly phase: GamePhase;
  readonly currentSeat: PlayerSeat;
  readonly adminSeat: PlayerSeat;
  readonly seed: number;
  readonly tiles: readonly TilePlacement[];
  readonly vertexIds: readonly string[];
  readonly edgeIds: readonly string[];
  /** Vertices the *recipient* may legally settle right now; empty when not their turn / wrong phase. */
  readonly legalSettlementVertexIds: readonly string[];
  /** Edges the *recipient* may legally (and affordably) build a road on right now. */
  readonly legalRoadEdgeIds: readonly string[];
  /** Own settlement vertices the *recipient* may legally upgrade to a city right now. */
  readonly legalCityVertexIds: readonly string[];
  /** Edges legal for a *free* road-building dev-card road (placement-legal, cost ignored). */
  readonly legalRoadBuildingEdgeIds: readonly string[];
  readonly settlements: readonly LobbySettlementDto[];
  readonly roads: readonly LobbyRoadDto[];
  readonly robberCoord: AxialCoordDto;
  readonly pendingRobberDiscardSeats: readonly PlayerSeat[];
  readonly pendingSetupRoadSeat: PlayerSeat | null;
  readonly pendingSetupRoadFromVertexId: string | null;
  readonly lastDiceRoll: DiceRollDto | null;
  readonly longestRoadSeat: PlayerSeat | null;
  readonly largestArmySeat: PlayerSeat | null;
  readonly winnerSeat: PlayerSeat | null;
  readonly devDeckCount: number;
  /**
   * Viewer-private dev-card identities — populated only with the recipient's
   * own cards, never with another player's. Ordered as held in the runtime
   * slot (oldest first). Cards bought this turn appear at the tail; the count
   * of unripened cards is `players[seat].devCardsBoughtThisTurn` for the same
   * seat.
   */
  readonly selfDevCards: readonly DevCardType[];
  /**
   * True when the viewer can pay the resource cost to buy a dev card right now.
   * Phase, turn, and deck availability are separate client gates.
   */
  readonly canAffordDevCard: boolean;
  readonly players: readonly LobbyPlayerPublicDto[];
}
