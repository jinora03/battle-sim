import { getArena } from '@kinetic/content';
import type { BattleDefinition, SimulationEvent, Vec2, WorldSnapshot } from '@kinetic/protocol';
import type { BroadcastRect } from './broadcastLayout';
import type { CinematicHighlightFocus } from './cinematicHighlights';
import type { ReplayVideoExportCameraSettings, VideoExportFrameRate } from './types';

export type CinematicCameraPhase = 'intro' | 'battle' | 'knockout' | 'result';

export interface CinematicCameraRenderOptions {
  phase?: CinematicCameraPhase;
  phaseProgress?: number;
  highlight?: CinematicHighlightFocus | null;
}

export interface BroadcastCameraFrame {
  source: BroadcastRect;
  zoom: number;
  emphasis: number;
  phase: CinematicCameraPhase;
}

interface SourcePoint extends Vec2 {
  margin: number;
}

interface SourceFit {
  scale: number;
  x: number;
  y: number;
}

const SOURCE_PADDING = 22;
const MAX_RELEVANT_PROJECTILES = 10;
const ULTIMATE_EXTRA_TICKS = 45;
const IMPORTANT_ABILITY_TICKS = 54;

/**
 * Export-only camera tracker. It crops the already-rendered arena canvas, so it
 * cannot alter simulation state or the normal interactive renderer.
 */
export class CinematicCameraTracker {
  private readonly arena: ReturnType<typeof getArena>;
  private readonly frameRate: VideoExportFrameRate;
  private currentCenterX = 0;
  private currentCenterY = 0;
  private currentZoom = 1;
  private initialized = false;
  private frameIndex = 0;
  private shakeEnergy = 0;
  private ultimateUntilTick = -1;
  private importantUntilTick = -1;
  private emphasisPosition: Vec2 | null = null;
  private knockoutPosition: Vec2 | null = null;

  constructor(
    private readonly battle: BattleDefinition,
    private readonly settings: ReplayVideoExportCameraSettings,
    frameRate: VideoExportFrameRate
  ) {
    this.arena = getArena(battle.arenaId);
    this.frameRate = frameRate;
  }

  update(
    arenaCanvas: HTMLCanvasElement,
    snapshot: WorldSnapshot,
    events: readonly SimulationEvent[],
    options: CinematicCameraRenderOptions = {}
  ): BroadcastCameraFrame {
    const phase = options.phase ?? 'battle';
    if (this.settings.mode === 'broadcast') {
      return {
        source: { x: 0, y: 0, width: arenaCanvas.width, height: arenaCanvas.height },
        zoom: 1,
        emphasis: 0,
        phase
      };
    }

    this.consumeEvents(events);
    const width = Math.max(1, arenaCanvas.width);
    const height = Math.max(1, arenaCanvas.height);
    const fit = calculateSourceFit(width, height, this.arena.width, this.arena.height);
    const points = this.collectFocusPoints(snapshot, fit, width, height, phase);
    const bounds = boundsFor(points, width, height);
    const phaseProgress = clamp01(options.phaseProgress ?? 0);
    const highlight = phase === 'battle' ? options.highlight ?? null : null;
    const ultimateActive = phase === 'battle' && snapshot.tick <= this.ultimateUntilTick;
    const importantActive = phase === 'battle' && snapshot.tick <= this.importantUntilTick;
    const wallSensitive = isSnapshotNearArenaWall(snapshot, this.arena.width, this.arena.height);

    let maxZoom = this.settings.maxZoom;
    if (wallSensitive || snapshot.projectiles.length >= 3) maxZoom = Math.min(maxZoom, 1.18);
    if (ultimateActive) maxZoom = Math.min(maxZoom, 1.12);
    if (phase === 'knockout') maxZoom = Math.min(maxZoom, 1.2);
    if (phase === 'intro' || phase === 'result') maxZoom = 1;

    const coverageZoom = calculateCoverageZoom(width, height, bounds, maxZoom);
    let desiredZoom = coverageZoom;
    if (importantActive && !ultimateActive) desiredZoom = Math.min(maxZoom, desiredZoom + 0.035);
    if (highlight && !ultimateActive) desiredZoom = Math.min(maxZoom, desiredZoom + 0.045 + highlight.intensity * 0.035);
    if (phase === 'knockout') desiredZoom = Math.min(maxZoom, 1.08 + easeOutCubic(phaseProgress) * 0.1);
    if (phase === 'intro' || phase === 'result') desiredZoom = 1;
    desiredZoom = Math.min(desiredZoom, coverageZoom);

    let desiredCenterX = (bounds.minX + bounds.maxX) / 2;
    let desiredCenterY = (bounds.minY + bounds.maxY) / 2;
    if ((ultimateActive || importantActive) && this.emphasisPosition) {
      const emphasis = worldToSource(this.emphasisPosition, fit);
      const weight = ultimateActive ? 0.12 : 0.18;
      desiredCenterX = lerp(desiredCenterX, emphasis.x, weight);
      desiredCenterY = lerp(desiredCenterY, emphasis.y, weight);
    }
    if (highlight?.position) {
      const highlightPoint = worldToSource(highlight.position, fit);
      const peak = 1 - Math.abs(highlight.progress * 2 - 1);
      const weight = 0.16 + highlight.intensity * 0.13 + peak * 0.05;
      desiredCenterX = lerp(desiredCenterX, highlightPoint.x, weight);
      desiredCenterY = lerp(desiredCenterY, highlightPoint.y, weight);
    }
    if (phase === 'knockout' && this.knockoutPosition) {
      const knockout = worldToSource(this.knockoutPosition, fit);
      const weight = 0.16 + easeOutCubic(phaseProgress) * 0.12;
      desiredCenterX = lerp(desiredCenterX, knockout.x, weight);
      desiredCenterY = lerp(desiredCenterY, knockout.y, weight);
    }
    if (phase === 'intro' || phase === 'result') {
      desiredCenterX = width / 2;
      desiredCenterY = height / 2;
    }

    if (!this.initialized) {
      this.currentCenterX = desiredCenterX;
      this.currentCenterY = desiredCenterY;
      this.currentZoom = desiredZoom;
      this.initialized = true;
    } else {
      const positionBlend = 1 - Math.exp(-8 / this.frameRate);
      const zoomBlend = 1 - Math.exp(-6 / this.frameRate);
      this.currentCenterX = lerp(this.currentCenterX, desiredCenterX, positionBlend);
      this.currentCenterY = lerp(this.currentCenterY, desiredCenterY, positionBlend);
      // During battle, zooming out happens immediately when coverage requires it.
      // Result framing eases back to arena-wide instead of snapping.
      this.currentZoom = desiredZoom < this.currentZoom && phase !== 'result' && phase !== 'intro'
        ? desiredZoom
        : lerp(this.currentZoom, desiredZoom, zoomBlend);
    }

    this.currentZoom = clamp(
      this.currentZoom,
      1,
      phase === 'intro' || phase === 'result' ? Math.max(1, this.settings.maxZoom) : coverageZoom
    );
    let source = sourceRectFor(
      this.currentCenterX,
      this.currentCenterY,
      width,
      height,
      this.currentZoom
    );
    source = ensureBoundsVisible(source, bounds, width, height);

    const shakeAmplitude = Math.min(width, height) * 0.008 * this.shakeEnergy / this.currentZoom;
    if (shakeAmplitude > 0.08 && phase !== 'intro' && phase !== 'result') {
      const shakeX = deterministicSigned(this.battle.seed, this.frameIndex, 0x51f2) * shakeAmplitude;
      const shakeY = deterministicSigned(this.battle.seed, this.frameIndex, 0xa73d) * shakeAmplitude;
      source = clampSourceRect({ ...source, x: source.x + shakeX, y: source.y + shakeY }, width, height);
    }

    const eventEmphasis = ultimateActive
      ? 0.7
      : importantActive
        ? 0.35
        : Math.min(0.3, this.shakeEnergy * 0.3);
    const highlightEmphasis = highlight
      ? Math.min(0.92, 0.42 + highlight.intensity * 0.42 + (highlight.slowMotion ? 0.08 : 0))
      : 0;
    const emphasis = phase === 'knockout'
      ? 1 - phaseProgress * 0.35
      : Math.max(eventEmphasis, highlightEmphasis);

    this.shakeEnergy *= Math.exp(-10 / this.frameRate);
    this.frameIndex += 1;
    return { source, zoom: this.currentZoom, emphasis, phase };
  }

  private consumeEvents(events: readonly SimulationEvent[]): void {
    for (const event of events) {
      if (event.type === 'abilityActivated') {
        this.emphasisPosition = event.position;
        if (event.slot === 'ultimate') {
          this.ultimateUntilTick = Math.max(this.ultimateUntilTick, event.tick + event.castTicks + ULTIMATE_EXTRA_TICKS);
          this.shakeEnergy = Math.max(this.shakeEnergy, 0.18);
        } else if (event.slot !== 'basic') {
          this.importantUntilTick = Math.max(this.importantUntilTick, event.tick + Math.max(IMPORTANT_ABILITY_TICKS, event.castTicks));
        }
      } else if (event.type === 'blast') {
        this.emphasisPosition = event.position;
        this.shakeEnergy = Math.max(this.shakeEnergy, clamp01(event.force / 24 + event.radius / 720));
      } else if (event.type === 'damage' && !event.prevented && event.amount >= 60) {
        if (event.position) this.emphasisPosition = event.position;
        this.shakeEnergy = Math.max(this.shakeEnergy, clamp01(event.amount / 230));
      } else if (event.type === 'wallImpact' && event.magnitude >= 8) {
        this.emphasisPosition = event.position;
        this.shakeEnergy = Math.max(this.shakeEnergy, clamp01(event.magnitude / 34));
      } else if (event.type === 'impact' && event.magnitude >= 8) {
        this.emphasisPosition = event.position;
        this.shakeEnergy = Math.max(this.shakeEnergy, clamp01(event.magnitude / 34));
      } else if (event.type === 'death') {
        this.knockoutPosition = event.position;
        this.emphasisPosition = event.position;
        this.shakeEnergy = 1;
      }
    }
  }

  private collectFocusPoints(
    snapshot: WorldSnapshot,
    fit: SourceFit,
    width: number,
    height: number,
    phase: CinematicCameraPhase
  ): SourcePoint[] {
    const alive = snapshot.entities.filter((entity) => entity.alive);
    const fighters = alive.length > 0 ? alive : snapshot.entities;
    const selectedFighters = fighters.length <= 8
      ? fighters
      : fighters.slice().sort((a, b) => b.hp - a.hp || a.id - b.id).slice(0, 8);
    const points: SourcePoint[] = selectedFighters.map((entity) => {
      const point = worldToSource(entity, fit);
      return { ...point, margin: Math.max(28, entity.radius * fit.scale + 34) };
    });

    const fighterCenter = selectedFighters.length > 0
      ? {
          x: selectedFighters.reduce((sum, entity) => sum + entity.x, 0) / selectedFighters.length,
          y: selectedFighters.reduce((sum, entity) => sum + entity.y, 0) / selectedFighters.length
        }
      : { x: this.arena.width / 2, y: this.arena.height / 2 };
    const relevantIds = new Set(selectedFighters.map((entity) => entity.id));
    const projectiles = snapshot.projectiles
      .filter((projectile) => projectile.alive && (relevantIds.has(projectile.sourceId) || projectile.targetId === undefined || relevantIds.has(projectile.targetId)))
      .sort((a, b) => distanceSquared(a, fighterCenter) - distanceSquared(b, fighterCenter) || a.id - b.id)
      .slice(0, MAX_RELEVANT_PROJECTILES);
    for (const projectile of projectiles) {
      const point = worldToSource(projectile, fit);
      points.push({ ...point, margin: Math.max(18, projectile.radius * fit.scale + 20) });
    }

    if (phase === 'knockout' && this.knockoutPosition) {
      const point = worldToSource(this.knockoutPosition, fit);
      points.push({ ...point, margin: Math.min(width, height) * 0.08 });
    }
    if (points.length === 0) points.push({ x: width / 2, y: height / 2, margin: Math.min(width, height) * 0.16 });
    return points;
  }
}

function calculateSourceFit(
  viewportWidth: number,
  viewportHeight: number,
  arenaWidth: number,
  arenaHeight: number
): SourceFit {
  const availableWidth = Math.max(1, viewportWidth - SOURCE_PADDING * 2);
  const availableHeight = Math.max(1, viewportHeight - SOURCE_PADDING * 2);
  const scale = Math.max(0.1, Math.min(availableWidth / Math.max(1, arenaWidth), availableHeight / Math.max(1, arenaHeight)));
  return {
    scale,
    x: (viewportWidth - arenaWidth * scale) / 2,
    y: (viewportHeight - arenaHeight * scale) / 2
  };
}

function worldToSource(point: Vec2, fit: SourceFit): Vec2 {
  return { x: fit.x + point.x * fit.scale, y: fit.y + point.y * fit.scale };
}

function boundsFor(points: readonly SourcePoint[], width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x - point.margin);
    minY = Math.min(minY, point.y - point.margin);
    maxX = Math.max(maxX, point.x + point.margin);
    maxY = Math.max(maxY, point.y + point.margin);
  }
  return {
    minX: clamp(minX, 0, width),
    minY: clamp(minY, 0, height),
    maxX: clamp(maxX, 0, width),
    maxY: clamp(maxY, 0, height)
  };
}

function calculateCoverageZoom(
  width: number,
  height: number,
  bounds: ReturnType<typeof boundsFor>,
  maxZoom: number
): number {
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
  return clamp(Math.min(width / boundsWidth, height / boundsHeight), 1, maxZoom);
}

function sourceRectFor(centerX: number, centerY: number, width: number, height: number, zoom: number): BroadcastRect {
  const sourceWidth = width / zoom;
  const sourceHeight = height / zoom;
  return clampSourceRect({
    x: centerX - sourceWidth / 2,
    y: centerY - sourceHeight / 2,
    width: sourceWidth,
    height: sourceHeight
  }, width, height);
}

function ensureBoundsVisible(
  source: BroadcastRect,
  bounds: ReturnType<typeof boundsFor>,
  width: number,
  height: number
): BroadcastRect {
  let x = source.x;
  let y = source.y;
  if (bounds.minX < x) x = bounds.minX;
  if (bounds.maxX > x + source.width) x = bounds.maxX - source.width;
  if (bounds.minY < y) y = bounds.minY;
  if (bounds.maxY > y + source.height) y = bounds.maxY - source.height;
  return clampSourceRect({ ...source, x, y }, width, height);
}

function clampSourceRect(source: BroadcastRect, width: number, height: number): BroadcastRect {
  const safeWidth = clamp(source.width, 1, width);
  const safeHeight = clamp(source.height, 1, height);
  return {
    x: clamp(source.x, 0, width - safeWidth),
    y: clamp(source.y, 0, height - safeHeight),
    width: safeWidth,
    height: safeHeight
  };
}

function isSnapshotNearArenaWall(snapshot: WorldSnapshot, arenaWidth: number, arenaHeight: number): boolean {
  const edgeX = arenaWidth * 0.1;
  const edgeY = arenaHeight * 0.1;
  for (const entity of snapshot.entities) {
    if (!entity.alive) continue;
    if (entity.x - entity.radius <= edgeX
      || entity.x + entity.radius >= arenaWidth - edgeX
      || entity.y - entity.radius <= edgeY
      || entity.y + entity.radius >= arenaHeight - edgeY) return true;
  }
  for (const projectile of snapshot.projectiles) {
    if (!projectile.alive) continue;
    if (projectile.x <= edgeX || projectile.x >= arenaWidth - edgeX
      || projectile.y <= edgeY || projectile.y >= arenaHeight - edgeY) return true;
  }
  return false;
}

function deterministicSigned(seed: number, frameIndex: number, salt: number): number {
  let value = (seed ^ Math.imul(frameIndex + 1, 0x9e3779b1) ^ salt) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value / 0xffffffff * 2 - 1;
}

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * clamp01(amount);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
