import { PCFSoftShadowMap, VSMShadowMap } from 'three';
import { ShadowQuality } from './shadow-quality.enum';

export interface ShadowQualityPreset {
  readonly shadowsEnabled: boolean;
  readonly mapSize: number;
  readonly shadowMapType: typeof VSMShadowMap | typeof PCFSoftShadowMap;
  readonly shadowRadius: number;
}

export function shadowQualityPreset(quality: ShadowQuality): ShadowQualityPreset {
  switch (quality) {
    case ShadowQuality.High:
      return {
        shadowsEnabled: true,
        mapSize: 2048,
        shadowMapType: VSMShadowMap,
        shadowRadius: 4,
      };
    case ShadowQuality.Medium:
      return {
        shadowsEnabled: true,
        mapSize: 1024,
        shadowMapType: PCFSoftShadowMap,
        shadowRadius: 3,
      };
    case ShadowQuality.Low:
      return {
        shadowsEnabled: false,
        mapSize: 512,
        shadowMapType: PCFSoftShadowMap,
        shadowRadius: 2,
      };
  }
}

export function parseShadowQuality(raw: string | null): ShadowQuality {
  if (raw === ShadowQuality.Low) {
    return ShadowQuality.Low;
  }
  if (raw === ShadowQuality.Medium) {
    return ShadowQuality.Medium;
  }
  if (raw === ShadowQuality.High) {
    return ShadowQuality.High;
  }
  return ShadowQuality.High;
}
