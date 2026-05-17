import type {
  AxialCoordDto,
  DevCardType,
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
  readonly isConnected: boolean;
  readonly resources: Readonly<Record<ResourceType, number>>;
  readonly devCardsInHand: number;
  /**
   * Only populated for the viewer's own seat. Other seats receive `null`;
   * those seats show generic backs in the 3D hand, count comes from
   * `devCardsInHand`.
   */
  readonly devCardTypes: readonly DevCardType[] | null;
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
