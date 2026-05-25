import { WebcamQuality } from '@catan/api-interfaces';
import { ShadowQuality } from '../../../game/scene/shadow-quality.enum';

export type PerformanceTier = 'low' | 'medium' | 'high';

export interface HardwareProbeSignals {
  readonly hardwareConcurrency: number | null;
  readonly deviceMemoryGb: number | null;
  readonly isMobile: boolean;
  readonly prefersReducedMotion: boolean;
  readonly saveData: boolean;
  readonly gpuRenderer: string | null;
}

interface NavigatorWithDeviceMemory {
  readonly deviceMemory?: number;
}

interface NavigatorUserAgentDataLike {
  readonly mobile?: boolean;
}

interface NavigatorWithUserAgentData {
  readonly userAgentData?: NavigatorUserAgentDataLike;
}

interface NavigatorConnectionLike {
  readonly saveData?: boolean;
}

interface NavigatorWithConnection {
  readonly connection?: NavigatorConnectionLike;
}

export function collectHardwareProbeSignals(): HardwareProbeSignals {
  const navMemoryView: NavigatorWithDeviceMemory = navigator;
  const navUaView: NavigatorWithUserAgentData = navigator;
  const navConnView: NavigatorWithConnection = navigator;
  const cores = Number.isFinite(navigator.hardwareConcurrency)
    ? navigator.hardwareConcurrency
    : null;
  const memory = typeof navMemoryView.deviceMemory === 'number' ? navMemoryView.deviceMemory : null;
  const mobile = navUaView.userAgentData?.mobile === true || isLegacyMobileUserAgent();
  const reducedMotion =
    typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const saveData = navConnView.connection?.saveData === true;
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
    return 'low';
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
    return 'high';
  }
  if (score >= 0) {
    return 'medium';
  }
  return 'low';
}

export function downgradeTier(tier: PerformanceTier): PerformanceTier {
  if (tier === 'high') {
    return 'medium';
  }
  if (tier === 'medium') {
    return 'low';
  }
  return 'low';
}

export function tierToShadowQuality(tier: PerformanceTier): ShadowQuality {
  if (tier === 'high') {
    return ShadowQuality.High;
  }
  if (tier === 'medium') {
    return ShadowQuality.Medium;
  }
  return ShadowQuality.Low;
}

export function tierToWebcamQuality(tier: PerformanceTier): WebcamQuality {
  if (tier === 'low') {
    return WebcamQuality.Low;
  }
  return WebcamQuality.Medium;
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
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext === null) {
      return null;
    }
    const renderer: unknown = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' && renderer.length > 0 ? renderer : null;
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
