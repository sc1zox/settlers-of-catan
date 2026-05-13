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

const RESOURCE_COLOR: Record<ResourceKind, string> = {
  [ResourceKind.Wood]: '#356f37',
  [ResourceKind.Brick]: '#a85a3a',
  [ResourceKind.Wool]: '#9fc960',
  [ResourceKind.Grain]: '#d9b25c',
  [ResourceKind.Ore]: '#6c6f76',
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

const CARD_W = 256;
const CARD_H = 384;

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain 2D canvas context.');
  return { canvas, ctx };
}

function paperBackground(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, '#fff5d9');
  g.addColorStop(1, '#f2dca6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

function paperBorder(ctx: CanvasRenderingContext2D, accent: string): void {
  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, CARD_W - 24, CARD_H - 24);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, CARD_W - 44, CARD_H - 44);
}

function finalize(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  // Cards lie flat on the table; with flipY=false the image's top row maps to
  // V=0 which, after the box-face UV mapping, ends up pointing toward the disc
  // (away from the seated player) — i.e. the text reads right-side up.
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

export function makeResourceFaceTexture(kind: ResourceKind): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  paperBackground(ctx);
  paperBorder(ctx, RESOURCE_COLOR[kind]);

  // Coloured panel filling the upper two-thirds — quick "icon" stand-in.
  ctx.fillStyle = RESOURCE_COLOR[kind];
  ctx.fillRect(40, 60, CARD_W - 80, 220);

  // Label
  ctx.fillStyle = '#2a1a0d';
  ctx.font = 'bold 38px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(RESOURCE_LABEL_DE[kind], CARD_W / 2, 330);
  return finalize(canvas);
}

export function makeResourceBackTexture(): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  // Deep forest-green back with a stamped wordmark.
  ctx.fillStyle = '#314c2b';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = '#cdbc7d';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, CARD_W - 40, CARD_H - 40);
  ctx.strokeRect(34, 34, CARD_W - 68, CARD_H - 68);

  ctx.fillStyle = '#e7d6a0';
  ctx.font = 'bold 42px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATAN', CARD_W / 2, CARD_H / 2 - 16);
  ctx.font = '20px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('Rohstoff', CARD_W / 2, CARD_H / 2 + 28);
  return finalize(canvas);
}

export function makeDevFaceTexture(kind: DevKind): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  paperBackground(ctx);
  paperBorder(ctx, '#7a2e3a');

  ctx.fillStyle = '#7a2e3a';
  ctx.fillRect(40, 60, CARD_W - 80, 220);

  ctx.fillStyle = '#fff5d9';
  ctx.font = 'bold 28px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Entwicklung', CARD_W / 2, 100);

  ctx.fillStyle = '#2a1a0d';
  ctx.font = 'bold 34px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(DEV_LABEL_DE[kind], CARD_W / 2, 330);
  return finalize(canvas);
}

export function makeDevBackTexture(): CanvasTexture {
  const { canvas, ctx } = newCanvas();
  ctx.fillStyle = '#4a2030';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = '#d6b06b';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, CARD_W - 40, CARD_H - 40);
  ctx.strokeRect(34, 34, CARD_W - 68, CARD_H - 68);

  ctx.fillStyle = '#f0d68c';
  ctx.font = 'bold 42px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATAN', CARD_W / 2, CARD_H / 2 - 16);
  ctx.font = '20px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('Entwicklung', CARD_W / 2, CARD_H / 2 + 28);
  return finalize(canvas);
}

/** Large reference card listing building costs. */
export function makeCostCardTexture(): CanvasTexture {
  const W = 768;
  const H = 480;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain 2D canvas context.');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fff3d2');
  bg.addColorStop(1, '#ecd49a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  ctx.fillStyle = '#2a1a0d';
  ctx.font = 'bold 40px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Baukosten', W / 2, 60);

  type Row = { label: string; resources: ResourceKind[] };
  const rows: Row[] = [
    {
      label: 'Straße',
      resources: [ResourceKind.Wood, ResourceKind.Brick],
    },
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

  const startY = 110;
  const rowH = 80;
  ctx.font = '600 26px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < rows.length; i++) {
    const y = startY + i * rowH;
    ctx.fillStyle = '#2a1a0d';
    ctx.fillText(rows[i].label, 50, y + rowH / 2);

    // Resource swatches
    let x = 330;
    for (const r of rows[i].resources) {
      ctx.fillStyle = RESOURCE_COLOR[r];
      ctx.fillRect(x, y + 12, 56, 56);
      ctx.strokeStyle = '#2a1a0d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y + 12, 56, 56);
      x += 66;
    }
  }
  return finalize(canvas);
}
