/** Mulberry32 — small deterministic PRNG so we can reproduce decoration layouts. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scatter `count` 2D points within a hexagon of given inner-radius. */
export function scatterInHex(
  innerRadius: number,
  count: number,
  rng: () => number,
): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  // Rejection sample inside a circle inscribed in the hex (slightly smaller margin).
  const r = innerRadius;
  let safety = count * 30;
  while (pts.length < count && safety-- > 0) {
    const u = rng();
    const v = rng();
    const radius = r * Math.sqrt(u);
    const theta = v * Math.PI * 2;
    pts.push({ x: Math.cos(theta) * radius, z: Math.sin(theta) * radius });
  }
  return pts;
}
