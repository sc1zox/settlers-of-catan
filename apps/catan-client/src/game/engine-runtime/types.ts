export interface PerformanceSnapshot {
  readonly fps: number;
  readonly frameMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly visibleTiles: number;
  readonly totalTiles: number;
  readonly visibleHarbors: number;
  readonly totalHarbors: number;
  readonly visiblePlayers: number;
  readonly totalPlayers: number;
  readonly boardOverlayVisible: boolean;
  readonly diceVisible: boolean;
}

export type PerformanceStatsHandler = (snapshot: PerformanceSnapshot) => void;
