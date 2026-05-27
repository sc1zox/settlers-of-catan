import { WebcamQuality } from '@catan/api-interfaces';
import { CloudDensity } from '../../../game/scene/cloud-density.enum';
import { RenderPixelRatio } from '../../../game/scene/render-pixel-ratio.enum';
import { ShadowQuality } from '../../../game/scene/shadow-quality.enum';

export enum PerformanceTier {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export interface HardwareProbeSignals {
  readonly hardwareConcurrency: number | null;
  readonly deviceMemoryGb: number | null;
  readonly isMobile: boolean;
  readonly prefersReducedMotion: boolean;
  readonly saveData: boolean;
  readonly gpuRenderer: string | null;
}

declare global {
  interface Navigator {
    readonly deviceMemory?: number;
    readonly userAgentData?: { readonly mobile?: boolean };
    readonly connection?: { readonly saveData?: boolean };
  }
}

export function collectHardwareProbeSignals(): HardwareProbeSignals {
  const cores = Number.isFinite(navigator.hardwareConcurrency)
    ? navigator.hardwareConcurrency
    : null;
  const memory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const mobile = navigator.userAgentData?.mobile === true || isLegacyMobileUserAgent();
  const reducedMotion =
    typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const saveData = navigator.connection?.saveData === true;
  return {
    hardwareConcurrency: cores,
    deviceMemoryGb: memory,
    isMobile: mobile,
    prefersReducedMotion: reducedMotion,
    saveData,
    gpuRenderer: readGpuRendererString(),
  };
}

export function classifyPerformanceTier(signals: HardwareProbeSignals): PerformanceTier {
  if (signals.prefersReducedMotion || signals.saveData) {
    return PerformanceTier.Low;
  }
  let score = 0;
  const cores = signals.hardwareConcurrency ?? 4;
  if (cores >= 8) {
    score += 2;
  } else if (cores >= 4) {
    score += 1;
  } else if (cores <= 2) {
    score -= 2;
  }
  if (signals.deviceMemoryGb !== null) {
    if (signals.deviceMemoryGb >= 8) {
      score += 2;
    } else if (signals.deviceMemoryGb >= 4) {
      score += 1;
    } else if (signals.deviceMemoryGb <= 2) {
      score -= 2;
    }
  }
  if (signals.isMobile) {
    score -= 3;
  }
  score += gpuRendererScore(signals.gpuRenderer);
  if (score >= 3) {
    return PerformanceTier.High;
  }
  if (score >= 0) {
    return PerformanceTier.Medium;
  }
  return PerformanceTier.Low;
}

export function downgradeTier(tier: PerformanceTier): PerformanceTier {
  if (tier === PerformanceTier.High) {
    return PerformanceTier.Medium;
  }
  return PerformanceTier.Low;
}

export interface PerformanceProfile {
  readonly shadowQuality: ShadowQuality;
  readonly webcamQuality: WebcamQuality;
  readonly renderPixelRatio: RenderPixelRatio;
  readonly cloudDensity: CloudDensity;
  readonly sunShaftsEnabled: boolean;
  readonly waterAnimationEnabled: boolean;
  readonly ambientAnimationsEnabled: boolean;
}

export function tierToProfile(tier: PerformanceTier): PerformanceProfile {
  switch (tier) {
    case PerformanceTier.High:
      return {
        shadowQuality: ShadowQuality.High,
        webcamQuality: WebcamQuality.Medium,
        renderPixelRatio: RenderPixelRatio.High,
        cloudDensity: CloudDensity.Full,
        sunShaftsEnabled: true,
        waterAnimationEnabled: true,
        ambientAnimationsEnabled: true,
      };
    case PerformanceTier.Medium:
      return {
        shadowQuality: ShadowQuality.Medium,
        webcamQuality: WebcamQuality.Medium,
        renderPixelRatio: RenderPixelRatio.Medium,
        cloudDensity: CloudDensity.Sparse,
        sunShaftsEnabled: false,
        waterAnimationEnabled: true,
        ambientAnimationsEnabled: true,
      };
    case PerformanceTier.Low:
      return {
        shadowQuality: ShadowQuality.Low,
        webcamQuality: WebcamQuality.Low,
        renderPixelRatio: RenderPixelRatio.Low,
        cloudDensity: CloudDensity.None,
        sunShaftsEnabled: false,
        waterAnimationEnabled: false,
        ambientAnimationsEnabled: false,
      };
  }
}

function gpuRendererScore(renderer: string | null): number {
  if (renderer === null) {
    return 0;
  }
  const lower = renderer.toLowerCase();
  if (
    lower.includes('apple') &&
    (lower.includes(' m1') ||
      lower.includes(' m2') ||
      lower.includes(' m3') ||
      lower.includes(' m4'))
  ) {
    return 2;
  }
  if (lower.includes('rtx') || lower.includes('geforce') || lower.includes('radeon rx')) {
    return 2;
  }
  if (lower.includes('nvidia') || lower.includes('radeon') || lower.includes('amd ')) {
    return 1;
  }
  if (lower.includes('intel') && (lower.includes(' hd ') || lower.includes(' uhd '))) {
    return -1;
  }
  if (lower.includes('mali') || lower.includes('adreno') || lower.includes('powervr')) {
    return -2;
  }
  return 0;
}

function readGpuRendererString(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl === null) {
      return null;
    }
    // `WEBGL_debug_renderer_info` is deprecated (Firefox emits a console warning).
    // Use the standard `RENDERER` parameter; fall back to the extension only if
    // it's not available.
    const direct = gl.getParameter(gl.RENDERER) as string | null;
    if (direct) {
      return direct;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext === null) {
      return null;
    }
    return (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string | null) ?? null;
  } catch {
    return null;
  } finally {
    if (canvas !== null) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

function isLegacyMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
    return false;
  }
  return /Android|iPhone|iPad|iPod|Mobile Safari|Opera Mini/i.test(navigator.userAgent);
}
