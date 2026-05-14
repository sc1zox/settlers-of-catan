import type { TilePlacement } from '@catan/shared-game-field';
import { GamePhase } from './game-phase.enum';
import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';
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

export interface LobbyPlayerPublicDto {
  readonly seat: PlayerSeat;
  readonly displayName: string;
  readonly isConnected: boolean;
  readonly isSelf: boolean;
  readonly resources: Readonly<Record<ResourceType, number>>;
  readonly devCardsInHand: number;
  readonly playedKnights: number;
  readonly visibleVictoryPoints: number;
  readonly totalVictoryPoints: number;
  readonly longestRoadLength: number;
  readonly harborRates: Readonly<Record<ResourceType | 'generic', number>>;
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
  readonly lobbyId: string;
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
  readonly players: readonly LobbyPlayerPublicDto[];
}
