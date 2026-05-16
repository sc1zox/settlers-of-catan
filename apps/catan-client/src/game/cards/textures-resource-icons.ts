import type { CanvasTexture } from 'three';
import { ResourceKind, RESOURCE_PALETTE, resourceKindLabel } from './textures-enums-labels';
import {
  CARD_H,
  CARD_W,
  finalizeCanvasTexture,
  headerStrip,
  nameLabel,
  newCanvas,
  ornateBorder,
  paperBackground,
  roundRect,
} from './textures-shared-canvas-primitives';

function drawTreeIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(cx - size * 0.06, cy + size * 0.22, size * 0.12, size * 0.28);
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const w = size * (0.37 + i * 0.16);
    const yTop = cy - size * 0.5 + i * size * 0.2;
    const yBot = yTop + size * 0.27;
    ctx.fillStyle = i % 2 === 0 ? '#2f5d3a' : '#3a7042';
    ctx.beginPath();
    ctx.moveTo(cx, yTop);
    ctx.lineTo(cx - w / 2, yBot);
    ctx.lineTo(cx + w / 2, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1f4a26';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawBrickIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const w = size * 0.95;
  const h = size * 0.78;
  const rows = 4;
  const cols = 2;
  const brickH = h / rows;
  const brickW = w / cols;
  const left = cx - w / 2;
  const top = cy - h / 2;
  ctx.strokeStyle = '#3d1d10';
  ctx.lineWidth = 2;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : -brickW / 2;
    for (let col = -1; col <= cols; col++) {
      const x = left + col * brickW + offset;
      const y = top + row * brickH;
      const x1 = Math.max(x, left);
      const x2 = Math.min(x + brickW, left + w);
      if (x2 <= x1) continue;
      const grad = ctx.createLinearGradient(x1, y, x1, y + brickH);
      grad.addColorStop(0, '#c87a52');
      grad.addColorStop(1, '#8a3f25');
      ctx.fillStyle = grad;
      ctx.fillRect(x1, y, x2 - x1, brickH);
      ctx.strokeRect(x1, y, x2 - x1, brickH);
    }
  }
}

function drawSheepIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const outline = '#1a1612';
  const outlineW = Math.max(3, Math.round(size * 0.028));
  const woolFill = '#f6f1e6';
  const headFill = '#3a2a1f';

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const drawOutlinedArc = (
    arcCx: number,
    arcCy: number,
    radius: number,
    fill: string,
  ): void => {
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = outline;
    ctx.lineWidth = outlineW;
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const drawOutlinedRect = (x: number, y: number, rw: number, rh: number, fill: string): void => {
    ctx.beginPath();
    ctx.rect(x, y, rw, rh);
    ctx.strokeStyle = outline;
    ctx.lineWidth = outlineW;
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const dx = Math.cos(a) * size * 0.22;
    const dy = Math.sin(a) * size * 0.16;
    drawOutlinedArc(cx + dx, cy + dy, size * 0.16, woolFill);
  }
  drawOutlinedArc(cx, cy, size * 0.22, woolFill);

  drawOutlinedArc(cx + size * 0.34, cy - size * 0.05, size * 0.13, headFill);
  drawOutlinedArc(cx + size * 0.38, cy - size * 0.08, size * 0.025, '#fff5d9');

  const legW = size * 0.06;
  const legH = size * 0.18;
  drawOutlinedRect(cx - size * 0.14, cy + size * 0.2, legW, legH, headFill);
  drawOutlinedRect(cx + size * 0.06, cy + size * 0.2, legW, legH, headFill);
}

function drawWheatIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.strokeStyle = '#7a5d2a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.4);
  ctx.lineTo(cx, cy - size * 0.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.12);
  ctx.quadraticCurveTo(cx - size * 0.18, cy + size * 0.08, cx - size * 0.22, cy + size * 0.26);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.04);
  ctx.quadraticCurveTo(cx + size * 0.18, cy - size * 0.02, cx + size * 0.22, cy + size * 0.18);
  ctx.stroke();
  ctx.lineWidth = 2;
  const grainRows = 5;
  for (let row = 0; row < grainRows; row += 1) {
    const y = cy - size * 0.36 + row * size * 0.075;
    for (const sign of [-1, 1] as const) {
      ctx.save();
      ctx.translate(cx + sign * size * 0.06, y);
      ctx.rotate(sign * 0.45);
      const grad = ctx.createLinearGradient(0, -size * 0.1, 0, size * 0.1);
      grad.addColorStop(0, '#f1deaa');
      grad.addColorStop(1, '#a8801f');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.05, size * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5d2a';
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawOreIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const grad = ctx.createLinearGradient(cx, cy - size * 0.4, cx, cy + size * 0.4);
  grad.addColorStop(0, '#b0b3b8');
  grad.addColorStop(1, '#5a5d62');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#2a2c30';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.45, cy + size * 0.32);
  ctx.lineTo(cx - size * 0.5, cy - size * 0.05);
  ctx.lineTo(cx - size * 0.2, cy - size * 0.4);
  ctx.lineTo(cx + size * 0.18, cy - size * 0.42);
  ctx.lineTo(cx + size * 0.45, cy - size * 0.1);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.05, cy - size * 0.3);
  ctx.lineTo(cx + size * 0.15, cy - size * 0.35);
  ctx.lineTo(cx + size * 0.18, cy - size * 0.05);
  ctx.lineTo(cx - size * 0.02, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f0e6a0';
  for (const [dx, dy, r] of [
    [-0.18, 0.05, 0.04],
    [0.1, 0.15, 0.05],
    [-0.05, -0.18, 0.035],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + size * dx, cy + size * dy, size * r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const RESOURCE_ICON: Record<
  ResourceKind,
  (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void
> = {
  [ResourceKind.Wood]: drawTreeIcon,
  [ResourceKind.Brick]: drawBrickIcon,
  [ResourceKind.Wool]: drawSheepIcon,
  [ResourceKind.Grain]: drawWheatIcon,
  [ResourceKind.Ore]: drawOreIcon,
};

function drawHarborRatioBand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ratioFrom: number,
  bandH: number,
): void {
  ctx.fillStyle = 'rgba(26, 22, 18, 0.82)';
  ctx.fillRect(0, h - bandH, w, bandH);
  ctx.fillStyle = '#fff8e8';
  ctx.font = `800 ${Math.round(bandH * 0.72)}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${ratioFrom}:1`, w / 2, h - bandH / 2);
}

function drawGenericHarborTradeIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const cardW = size * 0.34;
  const cardH = size * 0.48;
  const offsets = [-size * 0.22, 0, size * 0.22];
  const fills = ['#3a7042', '#a85a3a', '#d9b25c'];
  for (let i = 0; i < offsets.length; i += 1) {
    const x = cx + offsets[i] - cardW / 2;
    const y = cy - cardH / 2;
    ctx.fillStyle = fills[i];
    ctx.strokeStyle = '#1a1612';
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, cardW, cardH, 6);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#1a1612';
  ctx.font = `800 ${Math.round(size * 0.2)}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy + size * 0.02);
}

const HARBOR_FLAG_W = 512;
const HARBOR_FLAG_H = 288;
const HARBOR_FLAG_RATIO_BAND_H = 52;

export function makeHarborFlagTexture(
  resourceKind: ResourceKind | null,
  ratioFrom: number,
): CanvasTexture {
  const { canvas, ctx } = newCanvas(HARBOR_FLAG_W, HARBOR_FLAG_H);
  const iconAreaH = HARBOR_FLAG_H - HARBOR_FLAG_RATIO_BAND_H;
  const iconCenterY = iconAreaH / 2;
  const iconSize = iconAreaH * 0.84;
  const borderPad = 8;
  const iconPad = borderPad + 4;

  if (resourceKind !== null) {
    const palette = RESOURCE_PALETTE[resourceKind];
    ctx.fillStyle = palette.accentLight;
    ctx.fillRect(0, 0, HARBOR_FLAG_W, HARBOR_FLAG_H);
    ctx.strokeStyle = palette.accentDark;
    ctx.lineWidth = 8;
    ctx.strokeRect(
      borderPad,
      borderPad,
      HARBOR_FLAG_W - borderPad * 2,
      iconAreaH - borderPad,
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(iconPad, iconPad, HARBOR_FLAG_W - iconPad * 2, iconAreaH - iconPad);
    ctx.clip();
    RESOURCE_ICON[resourceKind](ctx, HARBOR_FLAG_W / 2, iconCenterY, iconSize);
    ctx.restore();
  } else {
    ctx.fillStyle = '#e8e8ee';
    ctx.fillRect(0, 0, HARBOR_FLAG_W, HARBOR_FLAG_H);
    ctx.strokeStyle = '#8a8a96';
    ctx.lineWidth = 8;
    ctx.strokeRect(
      borderPad,
      borderPad,
      HARBOR_FLAG_W - borderPad * 2,
      iconAreaH - borderPad,
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(iconPad, iconPad, HARBOR_FLAG_W - iconPad * 2, iconAreaH - iconPad);
    ctx.clip();
    drawGenericHarborTradeIcon(ctx, HARBOR_FLAG_W / 2, iconCenterY, iconSize * 0.88);
    ctx.restore();
  }

  drawHarborRatioBand(ctx, HARBOR_FLAG_W, HARBOR_FLAG_H, ratioFrom, HARBOR_FLAG_RATIO_BAND_H);
  return finalizeCanvasTexture(canvas);
}

export function makeResourceFaceTexture(kind: ResourceKind): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  const palette = RESOURCE_PALETTE[kind];
  paperBackground(ctx, CARD_W, CARD_H);
  ornateBorder(ctx, CARD_W, CARD_H, palette.accent);
  headerStrip(ctx, CARD_W, 50, 56, 'Rohstoff', palette);

  const panelTop = 142;
  const panelHeight = 290;
  ctx.fillStyle = palette.accentLight;
  roundRect(ctx, 56, panelTop, CARD_W - 112, panelHeight, 18);
  ctx.fill();
  ctx.strokeStyle = palette.accentDark;
  ctx.lineWidth = 3;
  roundRect(ctx, 56, panelTop, CARD_W - 112, panelHeight, 18);
  ctx.stroke();

  RESOURCE_ICON[kind](ctx, CARD_W / 2, panelTop + panelHeight / 2, panelHeight * 0.78);

  nameLabel(ctx, CARD_W, CARD_H - 70, resourceKindLabel(kind), palette.accent);
  return finalizeCanvasTexture(canvas);
}

export function makeResourceBackTexture(): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, '#3b5a32');
  g.addColorStop(1, '#1f3a1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = '#cdbc7d';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, CARD_W - 44, CARD_H - 44);
  ctx.strokeRect(36, 36, CARD_W - 72, CARD_H - 72);

  ctx.save();
  ctx.translate(CARD_W / 2, CARD_H / 2);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = '#cdbc7d';
  ctx.lineWidth = 3;
  ctx.strokeRect(-72, -72, 144, 144);
  ctx.strokeRect(-90, -90, 180, 180);
  ctx.restore();

  ctx.fillStyle = '#e7d6a0';
  ctx.font = '800 56px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATAN', CARD_W / 2, CARD_H / 2 - 10);
  ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('· ROHSTOFF ·', CARD_W / 2, CARD_H / 2 + 38);
  return finalizeCanvasTexture(canvas);
}
