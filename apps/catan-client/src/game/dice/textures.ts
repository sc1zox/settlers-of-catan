import { CanvasTexture, SRGBColorSpace } from 'three';

const FACE_SIZE = 256;

const PIP_LAYOUTS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.28, 0.25],
    [0.72, 0.25],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.75],
    [0.72, 0.75],
  ],
};

/**
 * Single canvas texture per die face — ivory background with rounded inset and
 * black pips. SRGB so the standard material lights it like a printed surface.
 */
export function makeDieFaceTexture(value: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = FACE_SIZE;
  canvas.height = FACE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain 2D canvas context for die face.');

  // Ivory background with a subtle inset border.
  ctx.fillStyle = '#f1ead6';
  ctx.fillRect(0, 0, FACE_SIZE, FACE_SIZE);

  ctx.strokeStyle = 'rgba(60, 50, 30, 0.35)';
  ctx.lineWidth = 6;
  const inset = 16;
  ctx.strokeRect(inset, inset, FACE_SIZE - inset * 2, FACE_SIZE - inset * 2);

  const layout = PIP_LAYOUTS[value];
  if (!layout) throw new Error(`No pip layout for die value ${value}.`);
  const pipRadius = FACE_SIZE * 0.085;

  for (const [u, v] of layout) {
    const x = u * FACE_SIZE;
    const y = v * FACE_SIZE;
    // Soft shadow under each pip for depth.
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.arc(x + 2, y + 4, pipRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#1c1612';
    ctx.arc(x, y, pipRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
