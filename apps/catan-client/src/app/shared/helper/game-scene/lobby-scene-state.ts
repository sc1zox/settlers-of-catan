import type {
  AxialCoordDto,
  GamePhase,
  LobbyRoadDto,
  LobbySettlementDto,
  PlayerSeat,
  ResourceType,
} from '@catan/api-interfaces';

export interface LobbyScenePlayerState {
  readonly seat: PlayerSeat;
  readonly displayName: string;
  readonly isSelf: boolean;
  readonly isBot: boolean;
  readonly resources: Readonly<Record<ResourceType, number>>;
  readonly devCardsInHand: number;
}

export interface LobbySceneState {
  readonly phase: GamePhase;
  readonly seed: number;
  readonly players: readonly LobbyScenePlayerState[];
  readonly settlements: readonly LobbySettlementDto[];
  readonly roads: readonly LobbyRoadDto[];
  readonly robberCoord: AxialCoordDto;
  readonly legalSettlementVertexIds: readonly string[];
  readonly legalRoadEdgeIds: readonly string[];
  readonly legalCityVertexIds: readonly string[];
  readonly legalRoadBuildingEdgeIds: readonly string[];
  readonly longestRoadSeat: PlayerSeat | null;
  readonly largestArmySeat: PlayerSeat | null;
}
