import { CanvasTexture, SRGBColorSpace } from 'three';
import type { TexturePalette } from './textures-enums-labels';

export const CARD_W = 384;
export const CARD_H = 576;

export function newCanvas(
  w: number = CARD_W,
  h: number = CARD_H,
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain 2D canvas context.');
  return { canvas, ctx };
}

export function paperBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fdf3d4');
  g.addColorStop(0.55, '#f6e3aa');
  g.addColorStop(1, '#e9cf86');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(60, 40, 20, 0.06)';
  for (let i = 0; i < 220; i++) {
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const x = ((seed - Math.floor(seed)) * w) | 0;
    const y2 = Math.sin(i * 78.233) * 43758.5453;
    const y = ((y2 - Math.floor(y2)) * h) | 0;
    ctx.fillRect(x, y, 1, 1);
  }

  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.7);
  vg.addColorStop(0, 'rgba(255, 240, 200, 0.0)');
  vg.addColorStop(1, 'rgba(70, 40, 10, 0.18)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

export function ornateBorder(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string): void {
  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 2;
  const corner = 22;
  for (const [cx, cy, sx, sy] of [
    [28, 28, 1, 1],
    [w - 28, 28, -1, 1],
    [28, h - 28, 1, -1],
    [w - 28, h - 28, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * corner, cy);
    ctx.lineTo(cx + sx * corner * 0.55, cy);
    ctx.lineTo(cx + sx * corner * 0.55, cy + sy * corner * 0.55);
    ctx.lineTo(cx, cy + sy * corner * 0.55);
    ctx.lineTo(cx, cy + sy * corner);
    ctx.stroke();
  }
}

export function headerStrip(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  height: number,
  text: string,
  palette: TexturePalette,
): void {
  const g = ctx.createLinearGradient(0, y, 0, y + height);
  g.addColorStop(0, palette.accent);
  g.addColorStop(1, palette.accentDark);
  ctx.fillStyle = g;
  ctx.fillRect(36, y, w - 72, height);

  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, y, w - 72, height);

  ctx.fillStyle = palette.accentLight;
  ctx.font = '700 22px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), w / 2, y + height / 2);
}

export function nameLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  cy: number,
  text: string,
  accent: string,
): void {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, cy - 36);
  ctx.lineTo(w - 70, cy - 36);
  ctx.moveTo(70, cy - 32);
  ctx.lineTo(w - 70, cy - 32);
  ctx.stroke();

  ctx.fillStyle = '#1f140a';
  ctx.font = '800 44px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, cy);
}

export function finalizeCanvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
