import type { CanvasTexture } from 'three';
import { ResourceKind, RESOURCE_PALETTE } from './textures-enums-labels';
import { RESOURCE_ICON } from './textures-resource-icons';
import {
  finalizeCanvasTexture,
  newCanvas,
  paperBackground,
  roundRect,
} from './textures-shared-canvas-primitives';

export function makeCostCardTexture(): CanvasTexture {
  const W = 960;
  const H = 600;
  const { canvas, ctx } = newCanvas(W, H);
  paperBackground(ctx, W, H);

  ctx.strokeStyle = '#2a1a0d';
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.strokeStyle = '#7a2e3a';
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, W - 68, H - 68);

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

  return finalizeCanvasTexture(canvas);
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
  return finalizeCanvasTexture(canvas);
}
