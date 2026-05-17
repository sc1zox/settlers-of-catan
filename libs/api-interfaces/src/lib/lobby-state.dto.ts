import type { TilePlacement } from '@catan/shared-game-field';
import { DevCardType } from './dev-card-type.enum';
import { GamePhase } from './game-phase.enum';
import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';
import type { TradeOfferDto } from './trade.dto';
import { AxialCoordDto, DiceRollDto } from './turn-flow.dto';

export enum GameDeltaType {
  SettlementBuilt = 'SETTLEMENT_BUILT',
  RoadBuilt = 'ROAD_BUILT',
}

export interface SettlementBuiltDelta {
  readonly type: GameDeltaType.SettlementBuilt;
  readonly seat: PlayerSeat;
  readonly vertexId: string;
}

export interface RoadBuiltDelta {
  readonly type: GameDeltaType.RoadBuilt;
  readonly seat: PlayerSeat;
  readonly edgeId: string;
}

export type GameDeltaPayload = SettlementBuiltDelta | RoadBuiltDelta;

export interface PlayerHarborRatesDto {
  /** Best generic (3:1 or 4:1) rate available to this player. */
  readonly generic: number;
  /** Effective per-resource rate (already collapses generic via min). */
  readonly perResource: Readonly<Record<ResourceType, number>>;
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
  readonly totalVictoryPoints: number;
  readonly longestRoadLength: number;
  readonly harborRates: PlayerHarborRatesDto;
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
  readonly players: readonly LobbyPlayerPublicDto[];
  /**
   * Currently open trade offers in this lobby (status === Open). Source of
   * truth for trade UI — a reconnecting client sees the same active offers
   * as everyone else without depending on the transient `TradeUpdated` event.
   */
  readonly activeTrades: readonly TradeOfferDto[];
}
