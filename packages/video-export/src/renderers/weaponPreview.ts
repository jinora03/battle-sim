import { getPrimaryAttack } from '@kinetic/content';
import type { BroadcastFighterView } from '../broadcastScene';

export interface WeaponPreviewDefinition {
  id: string;
  name: string;
  form: string;
  visualId: string;
}

const previewCache = new Map<string, WeaponPreviewDefinition | null>();
const previewCanvasCache = new Map<string, HTMLCanvasElement>();

/** Resolve static primary-attack presentation metadata once per weapon id. */
export function resolveWeaponPreviewDefinition(weaponId: string | null): WeaponPreviewDefinition | null {
  if (!weaponId) return null;
  if (previewCache.has(weaponId)) return previewCache.get(weaponId) ?? null;
  try {
    const attack = getPrimaryAttack(weaponId);
    const preview = {
      id: attack.id,
      name: attack.name,
      form: attack.form,
      visualId: attack.visualId
    } satisfies WeaponPreviewDefinition;
    previewCache.set(weaponId, preview);
    return preview;
  } catch {
    previewCache.set(weaponId, null);
    return null;
  }
}

/**
 * Small Canvas counterpart of the actual Pixi weapon silhouettes. The shapes
 * intentionally reuse the same attack form / visual id rather than external art.
 */
export function drawWeaponPreview(
  ctx: CanvasRenderingContext2D,
  fighter: Pick<BroadcastFighterView, 'weaponId' | 'visual'>,
  x: number,
  y: number,
  size: number,
  accent: string,
  contentScale = 0.78
): boolean {
  const attack = resolveWeaponPreviewDefinition(fighter.weaponId);
  if (!attack) return false;

  const core = hexColor(fighter.visual.coreColor);
  const dark = hexColor(fighter.visual.bodyDarkColor);
  const cacheKey = `${attack.id}:${size}:${contentScale}:${accent}:${core}:${dark}`;
  let canvas = previewCanvasCache.get(cacheKey);
  if (!canvas) {
    canvas = createWeaponPreviewCanvas(attack, size, accent, core, dark, contentScale);
    previewCanvasCache.set(cacheKey, canvas);
  }
  ctx.drawImage(canvas, x - canvas.width / 2, y - canvas.height / 2);
  return true;
}

function createWeaponPreviewCanvas(
  attack: WeaponPreviewDefinition,
  size: number,
  accent: string,
  core: string,
  dark: string,
  contentScale: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const extent = Math.max(1, Math.ceil(size + 6));
  canvas.width = extent;
  canvas.height = extent;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const r = size / 2;
  ctx.translate(extent / 2, extent / 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(3, 9, 18, 0.72)';
  ctx.strokeStyle = 'rgba(188, 220, 244, 0.22)';
  ctx.lineWidth = Math.max(1.2, size * 0.045);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.scale(contentScale, contentScale);
  drawConfiguredWeaponIcon(ctx, attack.form, attack.visualId, r, accent, core, dark);
  return canvas;
}

function drawConfiguredWeaponIcon(
  ctx: CanvasRenderingContext2D,
  form: string,
  visualId: string,
  r: number,
  accent: string,
  core: string,
  dark: string
): void {
  const s = r;
  if (visualId === 'skip-stone') {
    ctx.strokeStyle = '#91edff';
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, 0);
    ctx.lineTo(s * 0.12, 0);
    ctx.stroke();
    ctx.fillStyle = '#241a30';
    ctx.beginPath();
    ctx.arc(s * 0.36, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#91edff';
    ctx.lineWidth = s * 0.1;
    ctx.stroke();
    return;
  }

  if (form === 'fire') {
    ctx.fillStyle = '#ff5b28';
    circle(ctx, -s * 0.1, s * 0.05, s * 0.34);
    ctx.fillStyle = '#ffb33d';
    circle(ctx, s * 0.18, -s * 0.12, s * 0.26);
    ctx.fillStyle = '#ffe16f';
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 0.25);
    ctx.lineTo(s * 0.58, -s * 0.68);
    ctx.lineTo(s * 0.45, s * 0.02);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (form === 'water') {
    ctx.fillStyle = 'rgba(79, 211, 255, 0.78)';
    circle(ctx, s * 0.18, 0, s * 0.35);
    ctx.strokeStyle = '#c9f8ff';
    ctx.lineWidth = s * 0.12;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    circle(ctx, s * 0.05, -s * 0.13, s * 0.09);
    return;
  }

  if (form === 'lightning') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 0.42);
    ctx.lineTo(s * 0.05, -s * 0.08);
    ctx.lineTo(-s * 0.08, s * 0.06);
    ctx.lineTo(s * 0.45, s * 0.42);
    ctx.stroke();
    ctx.strokeStyle = '#8df6ff';
    ctx.lineWidth = s * 0.08;
    ctx.stroke();
    return;
  }

  if (form === 'rifle') {
    ctx.strokeStyle = '#f4fbff';
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(-s * 0.72, 0);
    ctx.lineTo(-s * 0.38, 0);
    ctx.moveTo(s * 0.3, 0);
    ctx.lineTo(s * 0.82, 0);
    ctx.stroke();
    ctx.fillStyle = '#202b36';
    ctx.fillRect(-s * 0.4, -s * 0.2, s * 0.78, s * 0.4);
    ctx.fillStyle = accent;
    ctx.fillRect(-s * 0.24, -s * 0.09, s * 0.52, s * 0.18);
    return;
  }

  if (form === 'launcher') {
    if (visualId.includes('rocket')) {
      ctx.fillStyle = '#29343d';
      ctx.fillRect(-s * 0.56, -s * 0.2, s * 1.08, s * 0.4);
      ctx.fillStyle = accent;
      ctx.fillRect(-s * 0.4, -s * 0.11, s * 0.75, s * 0.22);
      ctx.strokeStyle = '#ffc15d';
      ctx.lineWidth = s * 0.12;
      circleStroke(ctx, s * 0.48, 0, s * 0.24);
    } else {
      ctx.fillStyle = '#171a22';
      circle(ctx, s * 0.1, s * 0.08, s * 0.38);
      ctx.strokeStyle = '#ff883a';
      ctx.lineWidth = s * 0.12;
      ctx.stroke();
      ctx.strokeStyle = '#cab58e';
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(s * 0.28, -s * 0.2);
      ctx.lineTo(s * 0.55, -s * 0.55);
      ctx.stroke();
      ctx.fillStyle = '#ffd05a';
      circle(ctx, s * 0.58, -s * 0.58, s * 0.1);
    }
    return;
  }

  if (form === 'gauntlet') {
    ctx.fillStyle = dark;
    ctx.fillRect(-s * 0.55, -s * 0.24, s * 0.7, s * 0.48);
    ctx.fillStyle = accent;
    ctx.fillRect(-s * 0.02, -s * 0.36, s * 0.58, s * 0.72);
    ctx.fillStyle = core;
    ctx.fillRect(-s * 0.38, -s * 0.08, s * 0.55, s * 0.16);
    return;
  }

  if (form === 'claws') {
    ctx.lineWidth = s * 0.14;
    for (let index = -1; index <= 1; index += 1) {
      ctx.strokeStyle = index === 0 ? core : accent;
      ctx.beginPath();
      ctx.moveTo(-s * 0.48, index * s * 0.18);
      ctx.lineTo(s * 0.58, index * s * 0.24 - s * 0.08);
      ctx.stroke();
    }
    return;
  }

  if (form === 'void') {
    ctx.strokeStyle = '#58307f';
    ctx.lineWidth = s * 0.18;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.12);
    ctx.lineTo(s * 0.12, 0);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 0.2;
    ctx.beginPath();
    ctx.arc(s * 0.2, -s * 0.02, s * 0.46, -1.2, 1.15);
    ctx.stroke();
    return;
  }

  if (form === 'axe' || form === 'hammer') {
    ctx.strokeStyle = form === 'axe' ? '#c5f4ff' : '#8095a5';
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, s * 0.38);
    ctx.lineTo(s * 0.35, -s * 0.34);
    ctx.stroke();
    ctx.fillStyle = accent;
    if (form === 'axe') {
      ctx.beginPath();
      ctx.moveTo(s * 0.18, -s * 0.56);
      ctx.lineTo(s * 0.68, -s * 0.38);
      ctx.lineTo(s * 0.25, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(s * 0.16, -s * 0.62, s * 0.5, s * 0.38);
    }
    return;
  }

  if (form === 'spear') {
    ctx.strokeStyle = '#a9c7d7';
    ctx.lineWidth = s * 0.15;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, s * 0.38);
    ctx.lineTo(s * 0.55, -s * 0.32);
    ctx.stroke();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(s * 0.72, -s * 0.42);
    ctx.lineTo(s * 0.38, -s * 0.28);
    ctx.lineTo(s * 0.55, -s * 0.08);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (form === 'ice') {
    ctx.fillStyle = '#9ceeff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.68);
    ctx.lineTo(s * 0.48, 0);
    ctx.lineTo(-s * 0.05, s * 0.62);
    ctx.lineTo(-s * 0.38, 0);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (form === 'nature') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.4);
    ctx.quadraticCurveTo(0, -s * 0.1, s * 0.5, -s * 0.45);
    ctx.stroke();
    return;
  }

  // Sword/shield-compatible fallback matching the broad live weapon silhouette.
  ctx.strokeStyle = '#5a3624';
  ctx.lineWidth = s * 0.17;
  ctx.beginPath();
  ctx.moveTo(-s * 0.64, s * 0.42);
  ctx.lineTo(-s * 0.2, s * 0.12);
  ctx.stroke();
  ctx.strokeStyle = core;
  ctx.lineWidth = s * 0.15;
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.08);
  ctx.lineTo(-s * 0.02, s * 0.32);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, s * 0.08);
  ctx.lineTo(s * 0.62, -s * 0.55);
  ctx.lineTo(s * 0.48, -s * 0.12);
  ctx.lineTo(s * 0.04, s * 0.22);
  ctx.closePath();
  ctx.fill();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function circleStroke(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
