export interface PerformanceBenchmarkSummary {
  readonly sampleCount: number;
  readonly fpsP50: number;
  readonly fpsP95: number;
  readonly frameMsP50: number;
  readonly frameMsP95: number;
}

export function computePerformanceBenchmarkSummary(
  fpsSamples: readonly number[],
  frameMsSamples: readonly number[],
): PerformanceBenchmarkSummary | null {
  if (frameMsSamples.length === 0) {
    return null;
  }
  return {
    sampleCount: frameMsSamples.length,
    fpsP50: percentile(fpsSamples, 0.5),
    fpsP95: percentile(fpsSamples, 0.95),
    frameMsP50: percentile(frameMsSamples, 0.5),
    frameMsP95: percentile(frameMsSamples, 0.95),
  };
}

export function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * quantile)));
  return sorted[index] ?? 0;
}
