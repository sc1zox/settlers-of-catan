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
  PerformanceProfile,
  PerformanceTier,
  classifyPerformanceTier,
  collectHardwareProbeSignals,
  downgradeTier,
  tierToProfile,
} from './hardware-profile';
import { parseShadowQuality } from '../../../game/scene/shadow-quality-preset';
import { ShadowQuality } from '../../../game/scene/shadow-quality.enum';
import { CloudDensity } from '../../../game/scene/cloud-density.enum';
import { parseCloudDensity } from '../../../game/scene/cloud-density.preset';
import {
  RenderPixelRatio,
  parseRenderPixelRatio,
} from '../../../game/scene/render-pixel-ratio.enum';

const PROBE_SAMPLE_COUNT = 12;
const PROBE_FPS_FLOOR = 30;

@Injectable({
  providedIn: 'root',
})
export class GameSettingsService {
  private readonly autoDetectedTier: PerformanceTier = classifyPerformanceTier(
    collectHardwareProbeSignals(),
  );
  private readonly autoProfile: PerformanceProfile = tierToProfile(this.autoDetectedTier);
  private probeBaselineTier: PerformanceTier = this.autoDetectedTier;
  private probeActive = false;

  private readonly panelOpenSignal = signal<boolean>(false);
  private readonly shadowQualitySignal = signal<ShadowQuality>(this.loadShadowQuality());
  private readonly renderPixelRatioSignal = signal<RenderPixelRatio>(this.loadRenderPixelRatio());
  private readonly cloudDensitySignal = signal<CloudDensity>(this.loadCloudDensity());
  private readonly sunShaftsEnabledSignal = signal<boolean>(
    this.loadBoolDefault(ClientStorageKey.SunShaftsEnabled, this.autoProfile.sunShaftsEnabled),
  );
  private readonly waterAnimationEnabledSignal = signal<boolean>(
    this.loadBoolDefault(
      ClientStorageKey.WaterAnimationEnabled,
      this.autoProfile.waterAnimationEnabled,
    ),
  );
  private readonly ambientAnimationsEnabledSignal = signal<boolean>(
    this.loadBoolDefault(
      ClientStorageKey.AmbientAnimationsEnabled,
      this.autoProfile.ambientAnimationsEnabled,
    ),
  );
  private readonly performanceOverlaySignal = signal<boolean>(this.loadPerformanceOverlay());
  private readonly latestStatsSignal = signal<PerformanceSnapshot | null>(null);
  private readonly benchmarkActiveSignal = signal<boolean>(false);
  private readonly benchmarkSummarySignal = signal<PerformanceBenchmarkSummary | null>(null);
  private readonly benchmarkFpsSamples: number[] = [];
  private readonly benchmarkFrameMsSamples: number[] = [];
  private readonly webcamEnabledSignal = signal<boolean>(this.loadWebcamEnabled());
  private readonly webcamQualitySignal = signal<WebcamQuality>(this.loadWebcamQuality());
  private readonly sceneBrightnessSignal = signal<number>(this.loadSceneBrightness());
  private readonly probeActiveSignal = signal<boolean>(this.probeActive);
  private probeSampleCount = 0;
  private probeFpsSum = 0;

  private userTouchedShadowQuality = this.hasStored(ClientStorageKey.ShadowQuality);
  private userTouchedRenderPixelRatio = this.hasStored(ClientStorageKey.RenderPixelRatio);
  private userTouchedCloudDensity = this.hasStored(ClientStorageKey.CloudDensity);
  private userTouchedSunShafts = this.hasStored(ClientStorageKey.SunShaftsEnabled);
  private userTouchedWaterAnimation = this.hasStored(ClientStorageKey.WaterAnimationEnabled);
  private userTouchedAmbientAnimations = this.hasStored(ClientStorageKey.AmbientAnimationsEnabled);

  public readonly panelOpen = this.panelOpenSignal.asReadonly();
  public readonly webcamEnabled = this.webcamEnabledSignal.asReadonly();
  public readonly webcamQuality = this.webcamQualitySignal.asReadonly();
  public readonly sceneBrightness = this.sceneBrightnessSignal.asReadonly();
  public readonly sceneBrightnessMin = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMin];
  public readonly sceneBrightnessMax = SCENE_DISPLAY_SCOPE[SceneDisplayScopeKey.BrightnessMax];
  public readonly shadowQuality = this.shadowQualitySignal.asReadonly();
  public readonly renderPixelRatio = this.renderPixelRatioSignal.asReadonly();
  public readonly cloudDensity = this.cloudDensitySignal.asReadonly();
  public readonly sunShaftsEnabled = this.sunShaftsEnabledSignal.asReadonly();
  public readonly waterAnimationEnabled = this.waterAnimationEnabledSignal.asReadonly();
  public readonly ambientAnimationsEnabled = this.ambientAnimationsEnabledSignal.asReadonly();
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

  public setRenderPixelRatio(ratio: RenderPixelRatio): void {
    this.userTouchedRenderPixelRatio = true;
    this.renderPixelRatioSignal.set(ratio);
    localStorage.setItem(ClientStorageKey.RenderPixelRatio, ratio);
  }

  public setCloudDensity(density: CloudDensity): void {
    this.userTouchedCloudDensity = true;
    this.cloudDensitySignal.set(density);
    localStorage.setItem(ClientStorageKey.CloudDensity, density);
  }

  public setSunShaftsEnabled(enabled: boolean): void {
    this.userTouchedSunShafts = true;
    this.sunShaftsEnabledSignal.set(enabled);
    localStorage.setItem(ClientStorageKey.SunShaftsEnabled, enabled ? '1' : '0');
  }

  public setWaterAnimationEnabled(enabled: boolean): void {
    this.userTouchedWaterAnimation = true;
    this.waterAnimationEnabledSignal.set(enabled);
    localStorage.setItem(ClientStorageKey.WaterAnimationEnabled, enabled ? '1' : '0');
  }

  public setAmbientAnimationsEnabled(enabled: boolean): void {
    this.userTouchedAmbientAnimations = true;
    this.ambientAnimationsEnabledSignal.set(enabled);
    localStorage.setItem(ClientStorageKey.AmbientAnimationsEnabled, enabled ? '1' : '0');
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
    this.probeSampleCount = 0;
    this.probeFpsSum = 0;
    if (avgFps >= PROBE_FPS_FLOOR) {
      this.probeActive = false;
      this.probeActiveSignal.set(false);
      return;
    }
    const downgraded = downgradeTier(this.probeBaselineTier);
    if (downgraded === this.probeBaselineTier) {
      // Already at the lowest tier; nothing left to do.
      this.probeActive = false;
      this.probeActiveSignal.set(false);
      return;
    }
    this.probeBaselineTier = downgraded;
    this.applyTierDefaultsToUntouched(tierToProfile(downgraded));
    // Keep the probe armed so we can cascade further (e.g. Medium → Low) if
    // the new tier still doesn't hit the FPS floor on this device.
  }

  /**
   * After the runtime probe downgrades the tier, refresh every quality knob the
   * user hasn't manually touched so the new defaults take effect immediately.
   */
  private applyTierDefaultsToUntouched(profile: PerformanceProfile): void {
    if (!this.userTouchedShadowQuality) {
      this.shadowQualitySignal.set(profile.shadowQuality);
      localStorage.setItem(ClientStorageKey.ShadowQuality, profile.shadowQuality);
    }
    if (!this.userTouchedRenderPixelRatio) {
      this.renderPixelRatioSignal.set(profile.renderPixelRatio);
      localStorage.setItem(ClientStorageKey.RenderPixelRatio, profile.renderPixelRatio);
    }
    if (!this.userTouchedCloudDensity) {
      this.cloudDensitySignal.set(profile.cloudDensity);
      localStorage.setItem(ClientStorageKey.CloudDensity, profile.cloudDensity);
    }
    if (!this.userTouchedSunShafts) {
      this.sunShaftsEnabledSignal.set(profile.sunShaftsEnabled);
      localStorage.setItem(
        ClientStorageKey.SunShaftsEnabled,
        profile.sunShaftsEnabled ? '1' : '0',
      );
    }
    if (!this.userTouchedWaterAnimation) {
      this.waterAnimationEnabledSignal.set(profile.waterAnimationEnabled);
      localStorage.setItem(
        ClientStorageKey.WaterAnimationEnabled,
        profile.waterAnimationEnabled ? '1' : '0',
      );
    }
    if (!this.userTouchedAmbientAnimations) {
      this.ambientAnimationsEnabledSignal.set(profile.ambientAnimationsEnabled);
      localStorage.setItem(
        ClientStorageKey.AmbientAnimationsEnabled,
        profile.ambientAnimationsEnabled ? '1' : '0',
      );
    }
  }

  private hasStored(key: ClientStorageKey): boolean {
    return localStorage.getItem(key) !== null;
  }

  /**
   * If the user hasn't touched a setting yet, seed it from the auto-detected
   * profile and arm the runtime probe — that way an initial misclassification
   * (e.g. browser masks GPU info) can still be corrected after a few seconds of
   * real FPS data.
   */
  private loadShadowQuality(): ShadowQuality {
    const raw = localStorage.getItem(ClientStorageKey.ShadowQuality);
    if (raw !== null) {
      return parseShadowQuality(raw);
    }
    this.armProbe();
    localStorage.setItem(ClientStorageKey.ShadowQuality, this.autoProfile.shadowQuality);
    return this.autoProfile.shadowQuality;
  }

  private loadRenderPixelRatio(): RenderPixelRatio {
    const raw = localStorage.getItem(ClientStorageKey.RenderPixelRatio);
    if (raw !== null) {
      return parseRenderPixelRatio(raw);
    }
    this.armProbe();
    localStorage.setItem(ClientStorageKey.RenderPixelRatio, this.autoProfile.renderPixelRatio);
    return this.autoProfile.renderPixelRatio;
  }

  private loadCloudDensity(): CloudDensity {
    const raw = localStorage.getItem(ClientStorageKey.CloudDensity);
    if (raw !== null) {
      return parseCloudDensity(raw);
    }
    this.armProbe();
    localStorage.setItem(ClientStorageKey.CloudDensity, this.autoProfile.cloudDensity);
    return this.autoProfile.cloudDensity;
  }

  private loadBoolDefault(key: ClientStorageKey, autoValue: boolean): boolean {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      return raw === '1';
    }
    this.armProbe();
    localStorage.setItem(key, autoValue ? '1' : '0');
    return autoValue;
  }

  private armProbe(): void {
    this.probeActive = true;
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
    localStorage.setItem(ClientStorageKey.WebcamQuality, this.autoProfile.webcamQuality);
    return this.autoProfile.webcamQuality;
  }

  private loadSceneBrightness(): number {
    return parseSceneBrightness(localStorage.getItem(ClientStorageKey.SceneBrightness));
  }
}
