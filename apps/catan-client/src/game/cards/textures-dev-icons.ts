import type { CanvasTexture } from 'three';
import {
  CARD_H,
  CARD_W,
  finalizeCanvasTexture,
  newCanvas,
} from './textures-shared-canvas-primitives';

export function makeDevBackTexture(): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, '#502535');
  g.addColorStop(1, '#2a0f1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = '#d6b06b';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, CARD_W - 44, CARD_H - 44);
  ctx.strokeRect(36, 36, CARD_W - 72, CARD_H - 72);

  ctx.save();
  ctx.translate(CARD_W / 2, CARD_H / 2);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = '#d6b06b';
  ctx.lineWidth = 3;
  ctx.strokeRect(-72, -72, 144, 144);
  ctx.strokeRect(-90, -90, 180, 180);
  ctx.restore();

  ctx.fillStyle = '#f0d68c';
  ctx.font = '800 56px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATAN', CARD_W / 2, CARD_H / 2 - 10);
  ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('· ENTWICKLUNG ·', CARD_W / 2, CARD_H / 2 + 38);
  return finalizeCanvasTexture(canvas);
}
