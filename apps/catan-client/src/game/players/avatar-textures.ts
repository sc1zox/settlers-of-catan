import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  SRGBColorSpace,
} from 'three';
import { PlayerColor } from './player-color.enum';

export function buildSmileyCanvasTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = size * 0.02;
  ctx.stroke();
  ctx.fillStyle = '#1a2230';
  ctx.beginPath();
  ctx.arc(size * 0.36, size * 0.42, size * 0.055, 0, Math.PI * 2);
  ctx.arc(size * 0.64, size * 0.42, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a2230';
  ctx.lineWidth = size * 0.035;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.52, size * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const NAME_PLATE_TEXTURE_WIDTH = 1024;
const NAME_PLATE_TEXTURE_HEIGHT = 256;

export function buildNamePlateTexture(name: string, playerColor: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = NAME_PLATE_TEXTURE_WIDTH;
  canvas.height = NAME_PLATE_TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  const palette = namePlatePalette(playerColor);
  const w = canvas.width;
  const h = canvas.height;
  const padX = 56;
  const padY = 48;
  const plateLeft = padX;
  const plateRight = w - padX;
  const plateTop = padY;
  const plateBottom = h - padY;
  const plateHeight = plateBottom - plateTop;
  const notch = plateHeight * 0.42;

  ctx.clearRect(0, 0, w, h);

  tracePlatePath(ctx, plateLeft, plateTop, plateRight, plateBottom, notch);
  const fill = ctx.createLinearGradient(0, plateTop, 0, plateBottom);
  fill.addColorStop(0, palette.fillTop);
  fill.addColorStop(1, palette.fillBottom);
  ctx.fillStyle = fill;
  ctx.fill();

  const accentTop = plateTop + 6;
  const accentBottom = plateBottom - 6;
  const accent = ctx.createLinearGradient(0, accentTop, 0, accentBottom);
  accent.addColorStop(0, palette.border);
  accent.addColorStop(0.5, palette.borderBright);
  accent.addColorStop(1, palette.border);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.shadowColor = palette.borderGlow;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = palette.tick;
  const tickThickness = 6;
  const tickHeight = plateHeight * 0.46;
  const tickYTop = plateTop + (plateHeight - tickHeight) / 2;
  ctx.fillRect(plateLeft + 22, tickYTop, tickThickness, tickHeight);
  ctx.fillRect(plateRight - 22 - tickThickness, tickYTop, tickThickness, tickHeight);

  const upper = name.toUpperCase();
  const baseFont =
    '700 110px "Rajdhani", "Eurostile", "Bahnschrift", "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.font = baseFont;
  const trackingPx = 6;
  fillTrackedText(ctx, upper, w / 2, h / 2 + 4, trackingPx, {
    fill: palette.textFill,
    glow: palette.textGlow,
    glowBlur: 18,
    stroke: palette.textStroke,
    strokeWidth: 2,
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function namePlatePalette(playerColor: number): {
  fillTop: string;
  fillBottom: string;
  border: string;
  borderBright: string;
  borderGlow: string;
  tick: string;
  textFill: string;
  textGlow: string;
  textStroke: string;
} {
  const base = new Color(playerColor);
  const isWhite = playerColor === PlayerColor.White;
  const fillDark = base.clone().lerp(new Color(0, 0, 0), isWhite ? 0.52 : 0.28);
  const fillDarker = base.clone().lerp(new Color(0, 0, 0), isWhite ? 0.68 : 0.42);
  const border = base.clone();
  if (isWhite) {
    border.lerp(new Color(0.55, 0.58, 0.64), 0.35);
  } else {
    border.lerp(new Color(1, 1, 1), 0.18);
  }
  const borderBright = border.clone().lerp(new Color(1, 1, 1), isWhite ? 0.28 : 0.38);
  const tick = borderBright.clone().lerp(new Color(1, 1, 1), 0.12);
  return {
    fillTop: rgba(fillDark, 0.96),
    fillBottom: rgba(fillDarker, 0.98),
    border: rgba(border, 1),
    borderBright: rgba(borderBright, 1),
    borderGlow: rgba(borderBright, isWhite ? 0.82 : 0.9),
    tick: rgba(tick, 0.98),
    textFill: isWhite ? 'rgba(18, 24, 36, 0.98)' : 'rgba(248, 252, 255, 0.98)',
    textGlow: rgba(borderBright, isWhite ? 0.7 : 0.95),
    textStroke: isWhite ? 'rgba(255, 255, 255, 0.82)' : 'rgba(6, 12, 22, 0.9)',
  };
}

function rgba(color: Color, alpha: number): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tracePlatePath(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
  notch: number,
): void {
  ctx.beginPath();
  ctx.moveTo(left + notch, top);
  ctx.lineTo(right - notch, top);
  ctx.lineTo(right, top + notch);
  ctx.lineTo(right, bottom - notch);
  ctx.lineTo(right - notch, bottom);
  ctx.lineTo(left + notch, bottom);
  ctx.lineTo(left, bottom - notch);
  ctx.lineTo(left, top + notch);
  ctx.closePath();
}

function fillTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  trackingPx: number,
  style: {
    fill: string;
    glow: string;
    glowBlur: number;
    stroke: string;
    strokeWidth: number;
  },
): void {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let totalWidth = -trackingPx;
  const widths = new Array<number>(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const wMeasured = ctx.measureText(text.charAt(i)).width;
    widths[i] = wMeasured;
    totalWidth += wMeasured + trackingPx;
  }
  let cursor = centerX - totalWidth / 2;
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = style.glowBlur;
  ctx.fillStyle = style.fill;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    ctx.fillText(ch, cursor, centerY);
    cursor += widths[i] + trackingPx;
  }
  ctx.shadowBlur = 0;
  cursor = centerX - totalWidth / 2;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.strokeWidth;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    ctx.strokeText(ch, cursor, centerY);
    cursor += widths[i] + trackingPx;
  }
}
