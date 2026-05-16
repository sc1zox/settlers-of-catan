import type { CanvasTexture } from 'three';
import { BonusAwardKind } from '@catan/api-interfaces';
import { finalizeCanvasTexture, newCanvas, roundRect } from './textures-shared-canvas-primitives';

const BONUS_W = 960;
const BONUS_H = 600;

interface BonusCardSpec {
  readonly title: string;
  readonly subtitle: string;
  readonly accent: string;
  readonly accentDark: string;
  readonly draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void;
}

const BONUS_SPEC: Record<BonusAwardKind, BonusCardSpec> = {
  [BonusAwardKind.LongestRoad]: {
    title: 'Längste Handelsstraße',
    subtitle: '+2 Siegpunkte',
    accent: '#7a4e2e',
    accentDark: '#3a2010',
    draw: drawLongestRoadEmblem,
  },
  [BonusAwardKind.LargestArmy]: {
    title: 'Größte Rittermacht',
    subtitle: '+2 Siegpunkte',
    accent: '#7a2e3a',
    accentDark: '#3d1320',
    draw: drawLargestArmyEmblem,
  },
};

function drawLaurel(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.strokeStyle = '#bd9036';
  ctx.lineWidth = 5;
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * size * 0.55, cy + size * 0.55);
    ctx.quadraticCurveTo(
      cx + dir * size * 0.95,
      cy,
      cx + dir * size * 0.45,
      cy - size * 0.55,
    );
    ctx.stroke();
    for (let i = 0; i < 6; i += 1) {
      const t = 0.1 + i * 0.16;
      const px = cx + dir * (size * 0.55 + Math.sin(t * Math.PI) * size * 0.4);
      const py = cy + size * 0.55 - t * size * 1.1;
      ctx.beginPath();
      ctx.ellipse(px, py, size * 0.09, size * 0.04, dir * (0.6 + t * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = '#5d8e3a';
      ctx.fill();
      ctx.strokeStyle = '#3a5f22';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#bd9036';
      ctx.lineWidth = 5;
    }
  }
}

function drawLongestRoadEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.32);
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(-size * 0.62, -size * 0.22, size * 1.24, size * 0.44);
  ctx.fillStyle = '#8a5a2f';
  ctx.fillRect(-size * 0.62, -size * 0.2, size * 1.24, size * 0.4);
  ctx.fillStyle = '#a87a45';
  ctx.fillRect(-size * 0.62, -size * 0.18, size * 1.24, size * 0.1);
  ctx.strokeStyle = '#fff5d9';
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, 0);
  ctx.lineTo(size * 0.55, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  drawLaurel(ctx, cx, cy + size * 0.05, size * 0.78);
}

function drawLargestArmyEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const grad = ctx.createLinearGradient(cx, cy - size * 0.5, cx, cy + size * 0.5);
  grad.addColorStop(0, '#cdd3da');
  grad.addColorStop(1, '#3a3c40');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#1a1c20';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy + size * 0.55);
  ctx.lineTo(cx - size * 0.4, cy - size * 0.1);
  ctx.lineTo(cx - size * 0.22, cy - size * 0.5);
  ctx.lineTo(cx + size * 0.22, cy - size * 0.5);
  ctx.lineTo(cx + size * 0.4, cy - size * 0.1);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a2e3a';
  ctx.fillRect(cx - size * 0.3, cy - size * 0.06, size * 0.6, size * 0.1);
  ctx.fillStyle = '#bd2a3e';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.05, cy - size * 0.52);
  ctx.quadraticCurveTo(cx + size * 0.25, cy - size * 0.78, cx + size * 0.42, cy - size * 0.55);
  ctx.lineTo(cx + size * 0.1, cy - size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a1020';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawLaurel(ctx, cx, cy + size * 0.05, size * 0.84);
}

export function makeBonusCardTexture(kind: BonusAwardKind): CanvasTexture {
  const { canvas, ctx } = newCanvas(BONUS_W, BONUS_H);
  const spec = BONUS_SPEC[kind];

  const bg = ctx.createLinearGradient(0, 0, 0, BONUS_H);
  bg.addColorStop(0, '#fff3c8');
  bg.addColorStop(0.6, '#f1d680');
  bg.addColorStop(1, '#c8943a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BONUS_W, BONUS_H);

  ctx.fillStyle = 'rgba(255, 245, 200, 0.18)';
  for (let i = 0; i < 80; i += 1) {
    const seed = Math.sin(i * 23.18) * 43758.5453;
    const x = ((seed - Math.floor(seed)) * BONUS_W) | 0;
    const y2 = Math.sin(i * 91.74) * 43758.5453;
    const y = ((y2 - Math.floor(y2)) * BONUS_H) | 0;
    const r = ((Math.sin(i * 13.7) + 1) * 0.5 * 5) | 0;
    ctx.beginPath();
    ctx.arc(x, y, 2 + r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, BONUS_W - 40, BONUS_H - 40);
  ctx.strokeStyle = spec.accentDark;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, BONUS_W - 80, BONUS_H - 80);
  ctx.strokeStyle = '#bd9036';
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, BONUS_W - 112, BONUS_H - 112);

  ctx.fillStyle = spec.accentDark;
  roundRect(ctx, 96, 84, BONUS_W - 192, 84, 16);
  ctx.fill();
  ctx.fillStyle = '#fff5d2';
  ctx.font = '800 56px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.title, BONUS_W / 2, 126);

  spec.draw(ctx, BONUS_W / 2, 340, 200);

  ctx.fillStyle = '#2a1a0d';
  ctx.font = '700 34px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(spec.subtitle, BONUS_W / 2, BONUS_H - 80);

  return finalizeCanvasTexture(canvas);
}

export function makeBonusCardBackTexture(): CanvasTexture {
  const { canvas, ctx } = newCanvas(BONUS_W, BONUS_H);
  const g = ctx.createLinearGradient(0, 0, 0, BONUS_H);
  g.addColorStop(0, '#3b2913');
  g.addColorStop(1, '#1a0e05');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BONUS_W, BONUS_H);

  ctx.strokeStyle = '#d6b06b';
  ctx.lineWidth = 5;
  ctx.strokeRect(28, 28, BONUS_W - 56, BONUS_H - 56);
  ctx.strokeRect(46, 46, BONUS_W - 92, BONUS_H - 92);

  ctx.fillStyle = '#f0d68c';
  ctx.font = '800 72px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATAN', BONUS_W / 2, BONUS_H / 2 - 14);
  ctx.font = '500 26px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('· AUSZEICHNUNG ·', BONUS_W / 2, BONUS_H / 2 + 42);
  return finalizeCanvasTexture(canvas);
}
