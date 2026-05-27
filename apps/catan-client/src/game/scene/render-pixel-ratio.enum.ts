export enum RenderPixelRatio {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export function renderPixelRatioToValue(ratio: RenderPixelRatio): number {
  if (ratio === RenderPixelRatio.Low) {
    return 1;
  }
  if (ratio === RenderPixelRatio.Medium) {
    return Math.min(window.devicePixelRatio, 1.5);
  }
  return Math.min(window.devicePixelRatio, 2);
}

export function parseRenderPixelRatio(raw: string | null): RenderPixelRatio {
  if (raw === RenderPixelRatio.Low) {
    return RenderPixelRatio.Low;
  }
  if (raw === RenderPixelRatio.Medium) {
    return RenderPixelRatio.Medium;
  }
  return RenderPixelRatio.High;
}
