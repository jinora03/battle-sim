import type { BroadcastFighterView } from '../broadcastScene';

export function drawBroadcastFighterPortrait(
  ctx: CanvasRenderingContext2D,
  fighter: BroadcastFighterView,
  centerX: number,
  centerY: number,
  radius: number,
  facing: 'left' | 'right'
): void {
  const { visual } = fighter;
  const accent = color(visual.accentColor);
  const aura = color(visual.auraColor);
  const body = color(visual.bodyColor);
  const dark = color(visual.bodyDarkColor);
  const core = color(visual.coreColor);

  ctx.save();
  const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.25, centerX, centerY, radius * 1.45);
  glow.addColorStop(0, withAlpha(aura, 0.34));
  glow.addColorStop(0.62, withAlpha(aura, 0.14));
  glow.addColorStop(1, withAlpha(aura, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(accent, 0.88);
  ctx.lineWidth = Math.max(5, radius * 0.035);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  const shellRadius = radius * 0.72;
  const shellGradient = ctx.createRadialGradient(
    centerX - shellRadius * 0.26,
    centerY - shellRadius * 0.34,
    shellRadius * 0.12,
    centerX,
    centerY,
    shellRadius
  );
  shellGradient.addColorStop(0, body);
  shellGradient.addColorStop(0.65, dark);
  shellGradient.addColorStop(1, withAlpha(dark, 0.96));
  ctx.fillStyle = shellGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, shellRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(accent, 0.58);
  ctx.lineWidth = Math.max(4, radius * 0.025);
  ctx.stroke();

  if (visual.shape === 'mech') drawMechDetails(ctx, centerX, centerY, shellRadius, accent);
  else if (visual.shape === 'bomber') drawBomberDetails(ctx, centerX, centerY, shellRadius, accent);
  else if (visual.shape === 'water') drawWaterDetails(ctx, centerX, centerY, shellRadius, accent);
  else drawOrbDetails(ctx, centerX, centerY, shellRadius, accent);

  if (visual.horns) drawHorns(ctx, centerX, centerY, shellRadius, facing, accent);

  const coreRadius = radius * 0.19;
  const coreGradient = ctx.createRadialGradient(
    centerX - coreRadius * 0.32,
    centerY - coreRadius * 0.35,
    coreRadius * 0.08,
    centerX,
    centerY,
    coreRadius
  );
  coreGradient.addColorStop(0, '#ffffff');
  coreGradient.addColorStop(0.34, core);
  coreGradient.addColorStop(1, accent);
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha('#ffffff', 0.74);
  ctx.lineWidth = Math.max(2, radius * 0.014);
  ctx.stroke();
  ctx.restore();
}

function drawMechDetails(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, accent: string): void {
  ctx.save();
  ctx.fillStyle = withAlpha(accent, 0.48);
  ctx.fillRect(x - r * 0.72, y - r * 0.11, r * 1.44, r * 0.22);
  ctx.fillRect(x - r * 0.11, y - r * 0.72, r * 0.22, r * 1.44);
  ctx.restore();
}

function drawBomberDetails(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, accent: string): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(accent, 0.65);
  ctx.lineWidth = Math.max(3, r * 0.045);
  for (const scale of [0.7, 0.48]) {
    ctx.beginPath();
    ctx.arc(x, y, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let index = -1; index <= 1; index += 1) {
    const offset = index * r * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + offset - r * 0.15, y + r * 0.48);
    ctx.lineTo(x + offset + r * 0.12, y + r * 0.68);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWaterDetails(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, accent: string): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(accent, 0.58);
  ctx.lineWidth = Math.max(3, r * 0.04);
  ctx.beginPath();
  ctx.arc(x - r * 0.08, y + r * 0.05, r * 0.52, Math.PI * 0.08, Math.PI * 1.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 0.12, y - r * 0.08, r * 0.37, Math.PI * 1.1, Math.PI * 2.05);
  ctx.stroke();
  ctx.restore();
}

function drawOrbDetails(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, accent: string): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(accent, 0.48);
  ctx.lineWidth = Math.max(3, r * 0.035);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, Math.PI * 0.16, Math.PI * 1.52);
  ctx.stroke();
  ctx.restore();
}

function drawHorns(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  facing: 'left' | 'right',
  accent: string
): void {
  const direction = facing === 'right' ? 1 : -1;
  ctx.save();
  ctx.fillStyle = withAlpha(accent, 0.82);
  for (const yOffset of [-0.26, 0.26]) {
    ctx.beginPath();
    ctx.moveTo(x + direction * r * 0.7, y + r * yOffset);
    ctx.lineTo(x + direction * r * 1.04, y + r * (yOffset - 0.12));
    ctx.lineTo(x + direction * r * 0.78, y + r * (yOffset + 0.11));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
