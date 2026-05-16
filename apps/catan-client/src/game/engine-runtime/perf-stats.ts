import type { WebGLRenderer } from 'three';
import type { PerformanceSnapshot, PerformanceStatsHandler } from './types';

export class PerfStatsAggregator {
  private perfHandler: PerformanceStatsHandler | null = null;
  private perfAccumFrames = 0;
  private perfAccumSeconds = 0;
  private perfAccumFrameMs = 0;

  private perfLastVisibleTiles = 0;
  private perfLastVisibleHarbors = 0;
  private perfLastVisiblePlayers = 0;
  private perfLastActivePlayersTotal = 0;
  private perfLastBoardOverlayVisible = true;
  private perfLastDiceVisible = true;

  public setHandler(handler: PerformanceStatsHandler | null): void {
    this.perfHandler = handler;
  }

  public recordVisibility(snapshot: {
    visibleTiles: number;
    visibleHarbors: number;
    visiblePlayers: number;
    activePlayersTotal: number;
    boardOverlayVisible: boolean;
    diceVisible: boolean;
  }): void {
    this.perfLastVisibleTiles = snapshot.visibleTiles;
    this.perfLastVisibleHarbors = snapshot.visibleHarbors;
    this.perfLastVisiblePlayers = snapshot.visiblePlayers;
    this.perfLastActivePlayersTotal = snapshot.activePlayersTotal;
    this.perfLastBoardOverlayVisible = snapshot.boardOverlayVisible;
    this.perfLastDiceVisible = snapshot.diceVisible;
  }

  public tick(dt: number, renderer: WebGLRenderer, boardTileCount: number, harborCount: number): void {
    if (this.perfHandler === null) {
      this.perfAccumFrames = 0;
      this.perfAccumSeconds = 0;
      this.perfAccumFrameMs = 0;
      return;
    }
    this.perfAccumFrames += 1;
    this.perfAccumSeconds += dt;
    this.perfAccumFrameMs += dt * 1000;
    if (this.perfAccumSeconds < 0.5) {
      return;
    }
    const fps = this.perfAccumSeconds > 0 ? this.perfAccumFrames / this.perfAccumSeconds : 0;
    const frameMs = this.perfAccumFrames > 0 ? this.perfAccumFrameMs / this.perfAccumFrames : 0;
    const renderInfo = renderer.info.render;
    const memoryInfo = renderer.info.memory;
    const payload: PerformanceSnapshot = {
      fps,
      frameMs,
      drawCalls: renderInfo.calls,
      triangles: renderInfo.triangles,
      geometries: memoryInfo.geometries,
      textures: memoryInfo.textures,
      visibleTiles: this.perfLastVisibleTiles,
      totalTiles: boardTileCount,
      visibleHarbors: this.perfLastVisibleHarbors,
      totalHarbors: harborCount,
      visiblePlayers: this.perfLastVisiblePlayers,
      totalPlayers: this.perfLastActivePlayersTotal,
      boardOverlayVisible: this.perfLastBoardOverlayVisible,
      diceVisible: this.perfLastDiceVisible,
    };
    this.perfHandler(payload);
    this.perfAccumFrames = 0;
    this.perfAccumSeconds = 0;
    this.perfAccumFrameMs = 0;
  }
}
