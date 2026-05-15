import { Injectable, computed, signal } from '@angular/core';
import {
  ClientStorageKey,
  SCENE_DISPLAY_SCOPE,
  SceneDisplayScopeKey,
  WEBCAM_MEDIA_SCOPE,
  WebcamMediaScopeKey,
  WebcamQuality,
} from '@catan/api-interfaces';
import { parseSceneBrightness } from '../../shared/helper/game-settings/scene-brightness.util';
import { parseWebcamQuality } from '../../shared/helper/webcam/webcam-quality-preset';
import { PerformanceSnapshot } from '../../../game/engine';
import {
  PerformanceBenchmarkSummary,
  computePerformanceBenchmarkSummary,
} from '../../shared/helper/game-settings/performance-benchmark';
import { parseShadowQuality } from '../../../game/scene/shadow-quality-preset';
import { ShadowQuality } from '../../../game/scene/shadow-quality.enum';

@Injectable({
  providedIn: 'root',
})
export class GameSettingsService {
  private readonly panelOpenSignal = signal<boolean>(false);
  private readonly shadowQualitySignal = signal<ShadowQuality>(this.loadShadowQuality());
  private readonly performanceOverlaySignal = signal<boolean>(this.loadPerformanceOverlay());
  private readonly latestStatsSignal = signal<PerformanceSnapshot | null>(null);
  private readonly benchmarkActiveSignal = signal<boolean>(false);
  private readonly benchmarkSummarySignal = signal<PerformanceBenchmarkSummary | null>(null);
  private readonly benchmarkFpsSamples: number[] = [];
  private readonly benchmarkFrameMsSamples: number[] = [];
  private readonly webcamEnabledSignal = signal<boolean>(this.loadWebcamEnabled());
  private readonly webcamQualitySignal = signal<WebcamQuality>(this.loadWebcamQuality());
  private readonly sceneBrightnessSignal = signal<number>(this.loadSceneBrightness());

  public readonly panelOpen = this.panelOpenSignal.asReadonly();
  public readonly webcamEnabled = this.webcamEnabledSignal.asReadonly();
  public readonly webcamQuality = this.webcamQualitySignal.asReadonly();
  public readonly sceneBrightness = this.sceneBrightnessSignal.asReadonly();
  public readonly sceneBrightnessMin = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMin];
  public readonly sceneBrightnessMax = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMax];
  public readonly shadowQuality = this.shadowQualitySignal.asReadonly();
  public readonly performanceOverlayEnabled = this.performanceOverlaySignal.asReadonly();
  public readonly latestStats = this.latestStatsSignal.asReadonly();
  public readonly benchmarkActive = this.benchmarkActiveSignal.asReadonly();
  public readonly benchmarkSummary = this.benchmarkSummarySignal.asReadonly();

  public readonly performanceSamplingEnabled = computed<boolean>(
    () =>
      this.panelOpenSignal() ||
      this.performanceOverlaySignal() ||
      this.benchmarkActiveSignal(),
  );

  public togglePanel(): void {
    this.panelOpenSignal.update((open) => !open);
  }

  public closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  public setShadowQuality(quality: ShadowQuality): void {
    this.shadowQualitySignal.set(quality);
    localStorage.setItem(ClientStorageKey.ShadowQuality, quality);
  }

  public setPerformanceOverlayEnabled(enabled: boolean): void {
    this.performanceOverlaySignal.set(enabled);
    localStorage.setItem(ClientStorageKey.PerformanceOverlay, enabled ? '1' : '0');
  }

  public setWebcamEnabled(enabled: boolean): void {
    this.webcamEnabledSignal.set(enabled);
    localStorage.setItem(ClientStorageKey.WebcamEnabled, enabled ? '1' : '0');
  }

  public setWebcamQuality(quality: WebcamQuality): void {
    this.webcamQualitySignal.set(quality);
    localStorage.setItem(ClientStorageKey.WebcamQuality, quality);
  }

  public setSceneBrightness(brightness: number): void {
    const clamped = parseSceneBrightness(String(brightness));
    this.sceneBrightnessSignal.set(clamped);
    localStorage.setItem(ClientStorageKey.SceneBrightness, String(clamped));
  }

  public isPerformanceWithinWebcamTargets(stats: PerformanceSnapshot): boolean {
    return (
      stats.fps >= WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.PerformanceFpsFloor] &&
      stats.frameMs <= WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.PerformanceFrameMsCeiling]
    );
  }

  public toggleBenchmarkCapture(): void {
    this.benchmarkActiveSignal.update((active) => !active);
  }

  public resetBenchmarkCapture(): void {
    this.benchmarkFpsSamples.length = 0;
    this.benchmarkFrameMsSamples.length = 0;
    this.benchmarkSummarySignal.set(null);
  }

  public handlePerformanceStats(stats: PerformanceSnapshot): void {
    if (this.performanceSamplingEnabled()) {
      this.latestStatsSignal.set(stats);
    }
    if (!this.benchmarkActiveSignal()) {
      return;
    }
    this.benchmarkFpsSamples.push(stats.fps);
    this.benchmarkFrameMsSamples.push(stats.frameMs);
    this.benchmarkSummarySignal.set(
      computePerformanceBenchmarkSummary(this.benchmarkFpsSamples, this.benchmarkFrameMsSamples),
    );
  }

  private loadShadowQuality(): ShadowQuality {
    return parseShadowQuality(localStorage.getItem(ClientStorageKey.ShadowQuality));
  }

  private loadPerformanceOverlay(): boolean {
    return localStorage.getItem(ClientStorageKey.PerformanceOverlay) === '1';
  }

  private loadWebcamEnabled(): boolean {
    return localStorage.getItem(ClientStorageKey.WebcamEnabled) !== '0';
  }

  private loadWebcamQuality(): WebcamQuality {
    return parseWebcamQuality(localStorage.getItem(ClientStorageKey.WebcamQuality));
  }

  private loadSceneBrightness(): number {
    return parseSceneBrightness(localStorage.getItem(ClientStorageKey.SceneBrightness));
  }
}
