import { CanvasTexture, SRGBColorSpace } from 'three';

export enum ResourceKind {
  Wood = 'wood',
  Brick = 'brick',
  Wool = 'wool',
  Grain = 'grain',
  Ore = 'ore',
}

export const RESOURCE_LABEL_DE: Record<ResourceKind, string> = {
  [ResourceKind.Wood]: 'Holz',
  [ResourceKind.Brick]: 'Lehm',
  [ResourceKind.Wool]: 'Wolle',
  [ResourceKind.Grain]: 'Getreide',
  [ResourceKind.Ore]: 'Erz',
};

interface Palette {
  readonly accent: string;
  readonly accentDark: string;
  readonly accentLight: string;
}

const RESOURCE_PALETTE: Record<ResourceKind, Palette> = {
  [ResourceKind.Wood]: { accent: '#3a7042', accentDark: '#1f4a26', accentLight: '#a8d49b' },
  [ResourceKind.Brick]: { accent: '#a85a3a', accentDark: '#6b3520', accentLight: '#e0a487' },
  [ResourceKind.Wool]: { accent: '#9fc960', accentDark: '#5e8a30', accentLight: '#dfeec0' },
  [ResourceKind.Grain]: { accent: '#d9b25c', accentDark: '#8a6a22', accentLight: '#f1deaa' },
  [ResourceKind.Ore]: { accent: '#6c6f76', accentDark: '#3a3c40', accentLight: '#b8bbc0' },
};

export enum DevKind {
  Knight = 'knight',
  RoadBuilding = 'road',
  YearOfPlenty = 'plenty',
  Monopoly = 'monopoly',
  VictoryPoint = 'vp',
}

export const DEV_LABEL_DE: Record<DevKind, string> = {
  [DevKind.Knight]: 'Ritter',
  [DevKind.RoadBuilding]: 'Straßenbau',
  [DevKind.YearOfPlenty]: 'Erfindung',
  [DevKind.Monopoly]: 'Monopol',
  [DevKind.VictoryPoint]: 'Siegpunkt',
};

const DEV_PALETTE: Palette = {
  accent: '#7a2e3a',
  accentDark: '#3d1320',
  accentLight: '#d49aa6',
};

const CARD_W = 384;
const CARD_H = 576;

function newCanvas(w: number = CARD_W, h: number = CARD_H): {
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

function paperBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fdf3d4');
  g.addColorStop(0.55, '#f6e3aa');
  g.addColorStop(1, '#e9cf86');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Subtle paper grain — faint dark dots scattered with deterministic positions.
  ctx.fillStyle = 'rgba(60, 40, 20, 0.06)';
  for (let i = 0; i < 220; i++) {
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const x = ((seed - Math.floor(seed)) * w) | 0;
    const y2 = Math.sin(i * 78.233) * 43758.5453;
    const y = ((y2 - Math.floor(y2)) * h) | 0;
    ctx.fillRect(x, y, 1, 1);
  }

  // Soft vignette so the centre reads slightly brighter than the edges.
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.7);
  vg.addColorStop(0, 'rgba(255, 240, 200, 0.0)');
  vg.addColorStop(1, 'rgba(70, 40, 10, 0.18)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function ornateBorder(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string): void {
  // Outer dark frame
  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  // Inner accent line
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  // Corner flourishes
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

function headerStrip(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  height: number,
  text: string,
  palette: Palette,
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

function nameLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  cy: number,
  text: string,
  accent: string,
): void {
  // Decorative double line above the label.
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

function finalize(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  // flipY = true (default) — the canvas top row maps to UV v=1, which on the
  // BoxGeometry -Y face is local +Z. After the focus rotation in engine.ts that
  // becomes camera-up, so text reads upright.
  tex.needsUpdate = true;
  return tex;
}

// --- Resource icons (centred at cx, cy in a square of side `size`) ---

function drawTreeIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(cx - size * 0.06, cy + size * 0.22, size * 0.12, size * 0.28);
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const w = size * (0.85 - i * 0.16);
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

function drawBrickIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
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

function drawSheepIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // Cloud-like fluffy body.
  ctx.fillStyle = '#f6f1e6';
  ctx.strokeStyle = '#7a705f';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const dx = Math.cos(a) * size * 0.22;
    const dy = Math.sin(a) * size * 0.16;
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head + face
  ctx.fillStyle = '#3a2a1f';
  ctx.beginPath();
  ctx.arc(cx + size * 0.34, cy - size * 0.05, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff5d9';
  ctx.beginPath();
  ctx.arc(cx + size * 0.38, cy - size * 0.08, size * 0.025, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = '#3a2a1f';
  ctx.fillRect(cx - size * 0.14, cy + size * 0.2, size * 0.06, size * 0.18);
  ctx.fillRect(cx + size * 0.06, cy + size * 0.2, size * 0.06, size * 0.18);
}

function drawWheatIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.strokeStyle = '#7a5d2a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.5);
  ctx.lineTo(cx, cy - size * 0.2);
  ctx.stroke();
  // Stem leaves
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.15);
  ctx.quadraticCurveTo(cx - size * 0.2, cy + size * 0.1, cx - size * 0.25, cy + size * 0.3);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.05);
  ctx.quadraticCurveTo(cx + size * 0.2, cy, cx + size * 0.25, cy + size * 0.2);
  ctx.stroke();
  // Grains
  ctx.lineWidth = 2;
  for (let row = 0; row < 6; row++) {
    const y = cy - size * 0.45 + row * size * 0.12;
    for (const sign of [-1, 1] as const) {
      ctx.save();
      ctx.translate(cx + sign * size * 0.07, y);
      ctx.rotate(sign * 0.45);
      const grad = ctx.createLinearGradient(0, -size * 0.12, 0, size * 0.12);
      grad.addColorStop(0, '#f1deaa');
      grad.addColorStop(1, '#a8801f');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.06, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5d2a';
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawOreIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // Mountain-like polygonal rock.
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
  // Bright facet
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.05, cy - size * 0.3);
  ctx.lineTo(cx + size * 0.15, cy - size * 0.35);
  ctx.lineTo(cx + size * 0.18, cy - size * 0.05);
  ctx.lineTo(cx - size * 0.02, cy);
  ctx.closePath();
  ctx.fill();
  // Crystal sparkles
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

const RESOURCE_ICON: Record<
  ResourceKind,
  (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void
> = {
  [ResourceKind.Wood]: drawTreeIcon,
  [ResourceKind.Brick]: drawBrickIcon,
  [ResourceKind.Wool]: drawSheepIcon,
  [ResourceKind.Grain]: drawWheatIcon,
  [ResourceKind.Ore]: drawOreIcon,
};

// --- Dev card icons ---

function drawKnightIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // Helm silhouette.
  const grad = ctx.createLinearGradient(cx, cy - size * 0.4, cx, cy + size * 0.4);
  grad.addColorStop(0, '#b8bbc0');
  grad.addColorStop(1, '#3a3c40');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#1a1c20';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.32, cy + size * 0.4);
  ctx.lineTo(cx - size * 0.32, cy - size * 0.08);
  ctx.lineTo(cx - size * 0.18, cy - size * 0.4);
  ctx.lineTo(cx + size * 0.18, cy - size * 0.4);
  ctx.lineTo(cx + size * 0.32, cy - size * 0.08);
  ctx.lineTo(cx + size * 0.32, cy + size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Visor slit
  ctx.fillStyle = '#7a2e3a';
  ctx.fillRect(cx - size * 0.24, cy - size * 0.04, size * 0.48, size * 0.08);
  // Plume
  ctx.fillStyle = '#7a2e3a';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.05, cy - size * 0.4);
  ctx.quadraticCurveTo(cx + size * 0.15, cy - size * 0.6, cx + size * 0.25, cy - size * 0.45);
  ctx.lineTo(cx + size * 0.05, cy - size * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawRoadIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // Diagonal road with dashed centre line.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#3a2a1f';
  ctx.fillRect(-size * 0.5, -size * 0.18, size, size * 0.36);
  ctx.fillStyle = '#7a4e2e';
  ctx.fillRect(-size * 0.5, -size * 0.16, size, size * 0.32);
  ctx.strokeStyle = '#fff5d9';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, 0);
  ctx.lineTo(size * 0.45, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawCornucopiaIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // Curved horn pouring grain.
  ctx.fillStyle = '#a87a3a';
  ctx.strokeStyle = '#5a3a18';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy - size * 0.3);
  ctx.bezierCurveTo(
    cx - size * 0.55, cy + size * 0.25,
    cx + size * 0.2, cy + size * 0.45,
    cx + size * 0.4, cy + size * 0.1,
  );
  ctx.lineTo(cx + size * 0.18, cy - size * 0.05);
  ctx.bezierCurveTo(
    cx + size * 0.05, cy - size * 0.25,
    cx - size * 0.25, cy - size * 0.4,
    cx - size * 0.4, cy - size * 0.3,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Spilled goods
  for (const [dx, dy, color] of [
    [0.05, 0.2, '#d9b25c'],
    [0.18, 0.28, '#a85a3a'],
    [0.3, 0.18, '#3a7042'],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + size * dx, cy + size * dy, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMonopolyIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // Top hat
  ctx.fillStyle = '#1a1612';
  ctx.fillRect(cx - size * 0.28, cy - size * 0.4, size * 0.56, size * 0.5);
  ctx.fillRect(cx - size * 0.42, cy + size * 0.04, size * 0.84, size * 0.1);
  // Hat band
  ctx.fillStyle = '#7a2e3a';
  ctx.fillRect(cx - size * 0.28, cy - size * 0.05, size * 0.56, size * 0.1);
  // Reflection highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(cx - size * 0.22, cy - size * 0.36, size * 0.06, size * 0.4);
}

function drawCrownIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // Crown
  ctx.fillStyle = '#e2bf6a';
  ctx.strokeStyle = '#6a4a18';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy + size * 0.25);
  ctx.lineTo(cx - size * 0.4, cy);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.15);
  ctx.lineTo(cx - size * 0.1, cy - size * 0.22);
  ctx.lineTo(cx, cy + size * 0.1);
  ctx.lineTo(cx + size * 0.1, cy - size * 0.22);
  ctx.lineTo(cx + size * 0.22, cy + size * 0.15);
  ctx.lineTo(cx + size * 0.4, cy);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Gems
  for (const [dx, color] of [
    [-0.22, '#7a2e3a'],
    [0, '#3a7042'],
    [0.22, '#7a2e3a'],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + size * dx, cy + size * 0.13, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

const DEV_ICON: Record<
  DevKind,
  (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void
> = {
  [DevKind.Knight]: drawKnightIcon,
  [DevKind.RoadBuilding]: drawRoadIcon,
  [DevKind.YearOfPlenty]: drawCornucopiaIcon,
  [DevKind.Monopoly]: drawMonopolyIcon,
  [DevKind.VictoryPoint]: drawCrownIcon,
};

// --- Public texture builders ---

export function makeResourceFaceTexture(kind: ResourceKind): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  const palette = RESOURCE_PALETTE[kind];
  paperBackground(ctx, CARD_W, CARD_H);
  ornateBorder(ctx, CARD_W, CARD_H, palette.accent);
  headerStrip(ctx, CARD_W, 50, 56, 'Rohstoff', palette);

  // Icon panel — soft-tinted rounded square holding the illustration.
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

  nameLabel(ctx, CARD_W, CARD_H - 70, RESOURCE_LABEL_DE[kind], palette.accent);
  return finalize(canvas);
}

export function makeResourceBackTexture(): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  // Deep felt background with a stamped wordmark.
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, '#3b5a32');
  g.addColorStop(1, '#1f3a1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Decorative double border.
  ctx.strokeStyle = '#cdbc7d';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, CARD_W - 44, CARD_H - 44);
  ctx.strokeRect(36, 36, CARD_W - 72, CARD_H - 72);

  // Diamond emblem in centre.
  ctx.save();
  ctx.translate(CARD_W / 2, CARD_H / 2);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = '#cdbc7d';
  ctx.lineWidth = 3;
  ctx.strokeRect(-72, -72, 144, 144);
  ctx.strokeRect(-90, -90, 180, 180);
  ctx.restore();

  // Wordmark
  ctx.fillStyle = '#e7d6a0';
  ctx.font = '800 56px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATAN', CARD_W / 2, CARD_H / 2 - 10);
  ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('· ROHSTOFF ·', CARD_W / 2, CARD_H / 2 + 38);
  return finalize(canvas);
}

export function makeDevFaceTexture(kind: DevKind): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  paperBackground(ctx, CARD_W, CARD_H);
  ornateBorder(ctx, CARD_W, CARD_H, DEV_PALETTE.accent);
  headerStrip(ctx, CARD_W, 50, 56, 'Entwicklung', DEV_PALETTE);

  const panelTop = 142;
  const panelHeight = 290;
  ctx.fillStyle = DEV_PALETTE.accentLight;
  roundRect(ctx, 56, panelTop, CARD_W - 112, panelHeight, 18);
  ctx.fill();
  ctx.strokeStyle = DEV_PALETTE.accentDark;
  ctx.lineWidth = 3;
  roundRect(ctx, 56, panelTop, CARD_W - 112, panelHeight, 18);
  ctx.stroke();

  DEV_ICON[kind](ctx, CARD_W / 2, panelTop + panelHeight / 2, panelHeight * 0.78);

  nameLabel(ctx, CARD_W, CARD_H - 70, DEV_LABEL_DE[kind], DEV_PALETTE.accent);
  return finalize(canvas);
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
  return finalize(canvas);
}

/** Large reference card listing building costs. */
export function makeCostCardTexture(): CanvasTexture {
  const W = 960;
  const H = 600;
  const { canvas, ctx } = newCanvas(W, H);
  paperBackground(ctx, W, H);

  // Border + corner flourish (re-use ornament logic with custom dims).
  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.strokeStyle = '#7a2e3a';
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, W - 68, H - 68);

  // Header
  ctx.fillStyle = '#2a1a0d';
  ctx.font = '800 52px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Baukosten', W / 2, 92);

  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 116);
  ctx.lineTo(W - 120, 116);
  ctx.stroke();

  interface Row {
    readonly label: string;
    readonly resources: readonly ResourceKind[];
  }
  const rows: readonly Row[] = [
    { label: 'Straße', resources: [ResourceKind.Wood, ResourceKind.Brick] },
    {
      label: 'Siedlung',
      resources: [ResourceKind.Wood, ResourceKind.Brick, ResourceKind.Wool, ResourceKind.Grain],
    },
    {
      label: 'Stadt',
      resources: [
        ResourceKind.Grain,
        ResourceKind.Grain,
        ResourceKind.Ore,
        ResourceKind.Ore,
        ResourceKind.Ore,
      ],
    },
    {
      label: 'Entwicklungskarte',
      resources: [ResourceKind.Wool, ResourceKind.Grain, ResourceKind.Ore],
    },
  ];

  const startY = 152;
  const rowH = 102;
  const iconSize = 70;

  for (let i = 0; i < rows.length; i++) {
    const y = startY + i * rowH;
    // Subtle row stripe for the alternating rows.
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(122, 46, 58, 0.06)';
      ctx.fillRect(60, y, W - 120, rowH - 8);
    }

    ctx.fillStyle = '#1f140a';
    ctx.font = '700 32px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(rows[i].label, 86, y + rowH / 2);

    let x = 410;
    for (const r of rows[i].resources) {
      const palette = RESOURCE_PALETTE[r];
      ctx.fillStyle = palette.accentLight;
      roundRect(ctx, x, y + (rowH - iconSize) / 2 - 4, iconSize, iconSize, 10);
      ctx.fill();
      ctx.strokeStyle = palette.accentDark;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y + (rowH - iconSize) / 2 - 4, iconSize, iconSize, 10);
      ctx.stroke();
      RESOURCE_ICON[r](
        ctx,
        x + iconSize / 2,
        y + (rowH - iconSize) / 2 - 4 + iconSize / 2,
        iconSize * 0.85,
      );
      x += iconSize + 10;
    }
  }

  return finalize(canvas);
}

export function makeCostCardBackTexture(): CanvasTexture {
  const W = 960;
  const H = 600;
  const { canvas, ctx } = newCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#502535');
  g.addColorStop(1, '#2a0f1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#d6b06b';
  ctx.lineWidth = 5;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.strokeRect(46, 46, W - 92, H - 92);

  ctx.fillStyle = '#f0d68c';
  ctx.font = '800 70px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATAN', W / 2, H / 2 - 14);
  ctx.font = '500 26px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('· REFERENZKARTE ·', W / 2, H / 2 + 42);
  return finalize(canvas);
}

function roundRect(
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
