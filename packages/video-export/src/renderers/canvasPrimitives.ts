import type { BroadcastLayoutDefinition, BroadcastRect } from '../broadcastLayout';
import type { BroadcastFighterView } from '../broadcastScene';
import type { BroadcastCameraFrame } from '../cinematicCamera';

export const LEFT_ACCENT = '#59d8ff';
export const RIGHT_ACCENT = '#ff6f91';
export const READY_ACCENT = '#7af3be';
export const TEXT_PRIMARY = '#f4f8ff';
export const TEXT_SECONDARY = '#91a8c1';
export const PANEL_FILL = 'rgba(10, 18, 34, 0.92)';
export const PANEL_BORDER = 'rgba(151, 190, 231, 0.22)';

export function drawBroadcastBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  layout: BroadcastLayoutDefinition
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#07111f');
  gradient.addColorStop(0.52, '#080b17');
  gradient.addColorStop(1, '#12091a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = '#8fcfff';
  ctx.lineWidth = 1;
  const spacing = layout.id === 'vertical' ? 72 : 84;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.height, canvas.height);
    ctx.stroke();
  }
  ctx.restore();

  const topGlow = ctx.createRadialGradient(canvas.width * 0.5, 0, 0, canvas.width * 0.5, 0, canvas.width * 0.72);
  topGlow.addColorStop(0, 'rgba(64, 141, 255, 0.18)');
  topGlow.addColorStop(1, 'rgba(64, 141, 255, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, Math.min(canvas.height, canvas.width));
}

export function drawArenaFrame(
  ctx: CanvasRenderingContext2D,
  arenaCanvas: HTMLCanvasElement,
  rect: BroadcastRect,
  vertical: boolean,
  cameraFrame?: BroadcastCameraFrame
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = vertical ? 36 : 28;
  ctx.shadowOffsetY = 12;
  roundedRectPath(ctx, rect.x - 7, rect.y - 7, rect.width + 14, rect.height + 14, 24);
  ctx.fillStyle = '#050810';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, 18);
  ctx.clip();
  const source = cameraFrame?.source ?? { x: 0, y: 0, width: arenaCanvas.width, height: arenaCanvas.height };
  ctx.drawImage(
    arenaCanvas,
    source.x,
    source.y,
    source.width,
    source.height,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );
  const vignette = ctx.createRadialGradient(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    rect.width * 0.28,
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    rect.width * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  if (cameraFrame && cameraFrame.emphasis > 0.01) {
    const emphasis = Math.min(1, cameraFrame.emphasis);
    const edge = ctx.createRadialGradient(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width * 0.36,
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      rect.width * 0.72
    );
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(1, `rgba(5, 10, 22, ${0.08 + emphasis * 0.16})`);
    ctx.fillStyle = edge;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();

  roundedRectPath(ctx, rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4, 20);
  ctx.strokeStyle = 'rgba(116, 190, 255, 0.48)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  reverse: boolean
): void {
  roundedRectPath(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  const fillWidth = Math.max(fighter.hpRatio > 0 ? 5 : 0, width * fighter.hpRatio);
  if (fillWidth <= 0) return;
  roundedRectPath(ctx, reverse ? x + width - fillWidth : x, y, fillWidth, height, height / 2);
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  if (reverse) {
    gradient.addColorStop(0, '#ffb25f');
    gradient.addColorStop(1, accent);
  } else {
    gradient.addColorStop(0, accent);
    gradient.addColorStop(1, '#7af3be');
  }
  ctx.fillStyle = gradient;
  ctx.fill();
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke: string
): void {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawPill(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  textColor: string,
  fontSize: number
): void {
  roundedRectPath(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawText(ctx, label, x + width / 2, y + height / 2 + fontSize * 0.34, fontSize, 900, textColor, 'center', 0.5);
}

export function drawDivider(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  ctx.strokeStyle = 'rgba(151,190,231,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  align: CanvasTextAlign = 'left',
  letterSpacing = 0
): void {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (letterSpacing <= 0 || text.length < 2) {
    ctx.fillText(text, x, y);
    return;
  }
  const glyphs = [...text];
  const glyphWidths = glyphs.map((glyph) => ctx.measureText(glyph).width);
  const totalWidth = glyphWidths.reduce((sum, width) => sum + width, 0) + letterSpacing * (glyphs.length - 1);
  let cursor = align === 'center' ? x - totalWidth / 2 : align === 'right' ? x - totalWidth : x;
  for (let index = 0; index < glyphs.length; index += 1) {
    ctx.fillText(glyphs[index]!, cursor, y);
    cursor += glyphWidths[index]! + letterSpacing;
  }
}

export function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  preferredSize: number,
  weight: number,
  color: string,
  align: CanvasTextAlign
): void {
  let size = preferredSize;
  while (size > 10) {
    ctx.font = font(size, weight);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  drawText(ctx, text, x, y, size, weight, color, align);
}

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function font(size: number, weight: number): string {
  return `${weight} ${size}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}
