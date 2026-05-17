import type { CanvasTexture } from 'three';
import { DEV_PALETTE, DevKind, devKindLabel } from './textures-enums-labels';
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

function drawKnightIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  // Helmet body
  ctx.fillStyle = '#9e9c9a';
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.32, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Visor slit
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-size * 0.22, -size * 0.05, size * 0.44, size * 0.08);
  // Plume
  ctx.fillStyle = '#a83545';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.4);
  ctx.quadraticCurveTo(size * 0.18, -size * 0.55, size * 0.05, -size * 0.7);
  ctx.quadraticCurveTo(-size * 0.05, -size * 0.55, 0, -size * 0.4);
  ctx.fill();
  // Sword crossing behind
  ctx.strokeStyle = '#c4b073';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, size * 0.45);
  ctx.lineTo(size * 0.45, -size * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawRoadBuildingIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#7a5a3a';
  ctx.strokeStyle = '#3a2515';
  ctx.lineWidth = 3;
  // Two stacked road planks at angles
  ctx.save();
  ctx.rotate(-Math.PI / 8);
  roundRect(ctx, -size * 0.4, -size * 0.18, size * 0.8, size * 0.16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.rotate(Math.PI / 8);
  roundRect(ctx, -size * 0.4, size * 0.04, size * 0.8, size * 0.16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawYearOfPlentyIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  // Horn body
  ctx.fillStyle = '#c89a5a';
  ctx.strokeStyle = '#5a3818';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, size * 0.25);
  ctx.quadraticCurveTo(-size * 0.5, -size * 0.3, size * 0.05, -size * 0.4);
  ctx.quadraticCurveTo(size * 0.45, -size * 0.35, size * 0.4, 0);
  ctx.quadraticCurveTo(size * 0.2, size * 0.35, -size * 0.4, size * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fruit
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(size * 0.05, -size * 0.05, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.arc(size * 0.2, -size * 0.18, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(-size * 0.1, -size * 0.18, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMonopolyIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  // Top hat
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 3;
  // Brim
  ctx.fillRect(-size * 0.45, size * 0.18, size * 0.9, size * 0.08);
  ctx.strokeRect(-size * 0.45, size * 0.18, size * 0.9, size * 0.08);
  // Crown
  ctx.fillRect(-size * 0.28, -size * 0.4, size * 0.56, size * 0.6);
  ctx.strokeRect(-size * 0.28, -size * 0.4, size * 0.56, size * 0.6);
  // Band
  ctx.fillStyle = '#a83545';
  ctx.fillRect(-size * 0.28, size * 0.05, size * 0.56, size * 0.12);
  ctx.restore();
}

function drawVictoryPointIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  // Star
  ctx.fillStyle = '#f5d23a';
  ctx.strokeStyle = '#7a5a10';
  ctx.lineWidth = 3;
  const spikes = 5;
  const outer = size * 0.45;
  const inner = size * 0.2;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

const DEV_ICON: Record<
  DevKind,
  (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void
> = {
  [DevKind.Knight]: drawKnightIcon,
  [DevKind.RoadBuilding]: drawRoadBuildingIcon,
  [DevKind.YearOfPlenty]: drawYearOfPlentyIcon,
  [DevKind.Monopoly]: drawMonopolyIcon,
  [DevKind.VictoryPoint]: drawVictoryPointIcon,
};

export function makeDevFaceTexture(kind: DevKind): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  const palette = DEV_PALETTE;
  paperBackground(ctx, CARD_W, CARD_H);
  ornateBorder(ctx, CARD_W, CARD_H, palette.accent);
  headerStrip(ctx, CARD_W, 50, 56, 'Entwicklung', palette);

  const panelTop = 142;
  const panelHeight = 290;
  ctx.fillStyle = palette.accentLight;
  roundRect(ctx, 56, panelTop, CARD_W - 112, panelHeight, 18);
  ctx.fill();
  ctx.strokeStyle = palette.accentDark;
  ctx.lineWidth = 3;
  roundRect(ctx, 56, panelTop, CARD_W - 112, panelHeight, 18);
  ctx.stroke();

  DEV_ICON[kind](ctx, CARD_W / 2, panelTop + panelHeight / 2, panelHeight * 0.78);

  nameLabel(ctx, CARD_W, CARD_H - 70, devKindLabel(kind), palette.accent);
  return finalizeCanvasTexture(canvas);
}

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
