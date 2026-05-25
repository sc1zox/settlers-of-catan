import { Injectable, computed, signal } from '@angular/core';
import {
  SCENE_DISPLAY_SCOPE,
  SceneDisplayScopeKey,
  WEBCAM_MEDIA_SCOPE,
  WebcamMediaScopeKey,
  WebcamQuality,
} from '@catan/api-interfaces';
import { ClientStorageKey } from '../../../shared/client-constants';
import { parseSceneBrightness } from './scene-brightness.util';
import { parseWebcamQuality } from '../webcam-head/webcam-quality-preset';
import { PerformanceSnapshot } from '../../../game/engine';
import {
  PerformanceBenchmarkSummary,
  computePerformanceBenchmarkSummary,
} from './performance-benchmark';
import {
  PerformanceTier,
  classifyPerformanceTier,
  collectHardwareProbeSignals,
  downgradeTier,
  tierToShadowQuality,
  tierToWebcamQuality,
} from './hardware-profile';
import { parseShadowQuality } from '../../../game/scene/shadow-quality-preset';
import { ShadowQuality } from '../../../game/scene/shadow-quality.enum';

const PROBE_SAMPLE_COUNT = 12;
const PROBE_FPS_FLOOR = 30;

function shadowQualityToTier(quality: ShadowQuality): PerformanceTier {
  if (quality === ShadowQuality.High) {
    return 'high';
  }
  if (quality === ShadowQuality.Medium) {
    return 'medium';
  }
  return 'low';
}

@Injectable({
  providedIn: 'root',
})
export class GameSettingsService {
  private readonly autoDetectedTier: PerformanceTier = classifyPerformanceTier(
    collectHardwareProbeSignals(),
  );
  private shadowQualityWasAutoDetected = false;
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
  private readonly probeActiveSignal = signal<boolean>(this.shadowQualityWasAutoDetected);
  private probeSampleCount = 0;
  private probeFpsSum = 0;
  private readonly probeBaselineQuality: ShadowQuality = this.shadowQualitySignal();
  private userTouchedShadowQuality = false;

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
      this.benchmarkActiveSignal() ||
      this.probeActiveSignal(),
  );

  public togglePanel(): void {
    this.panelOpenSignal.update((open) => !open);
  }

  public closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  public setShadowQuality(quality: ShadowQuality): void {
    this.userTouchedShadowQuality = true;
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
    if (this.probeActiveSignal()) {
      this.recordProbeSample(stats);
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

  private recordProbeSample(stats: PerformanceSnapshot): void {
    this.probeFpsSum += stats.fps;
    this.probeSampleCount += 1;
    if (this.probeSampleCount < PROBE_SAMPLE_COUNT) {
      return;
    }
    const avgFps = this.probeFpsSum / this.probeSampleCount;
    this.probeActiveSignal.set(false);
    if (this.userTouchedShadowQuality) {
      return;
    }
    if (avgFps >= PROBE_FPS_FLOOR) {
      return;
    }
    const downgraded = tierToShadowQuality(
      downgradeTier(shadowQualityToTier(this.probeBaselineQuality)),
    );
    if (downgraded === this.probeBaselineQuality) {
      return;
    }
    this.shadowQualitySignal.set(downgraded);
    localStorage.setItem(ClientStorageKey.ShadowQuality, downgraded);
  }

  private loadShadowQuality(): ShadowQuality {
    const raw = localStorage.getItem(ClientStorageKey.ShadowQuality);
    if (raw !== null) {
      return parseShadowQuality(raw);
    }
    this.shadowQualityWasAutoDetected = true;
    const auto = tierToShadowQuality(this.autoDetectedTier);
    localStorage.setItem(ClientStorageKey.ShadowQuality, auto);
    return auto;
  }

  private loadPerformanceOverlay(): boolean {
    return localStorage.getItem(ClientStorageKey.PerformanceOverlay) === '1';
  }

  private loadWebcamEnabled(): boolean {
    return localStorage.getItem(ClientStorageKey.WebcamEnabled) !== '0';
  }

  private loadWebcamQuality(): WebcamQuality {
    const raw = localStorage.getItem(ClientStorageKey.WebcamQuality);
    if (raw !== null) {
      return parseWebcamQuality(raw);
    }
    const auto = tierToWebcamQuality(this.autoDetectedTier);
    localStorage.setItem(ClientStorageKey.WebcamQuality, auto);
    return auto;
  }

  private loadSceneBrightness(): number {
    return parseSceneBrightness(localStorage.getItem(ClientStorageKey.SceneBrightness));
  }
}
