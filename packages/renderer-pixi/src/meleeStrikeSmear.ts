import type { Vec2 } from '@kinetic/protocol';

/**
 * Presentation-only motion smear for melee strikes.
 *
 * The prior swing FX drew a fixed-length swoosh trailing the current blade
 * angle. A real swing reads as a motion blur: translucent ghost copies of the
 * blade fanned across the arc it has already crossed, longest while the blade
 * is moving fastest and collapsing to nothing at the start and end of the
 * stroke. A thrust reads the same way along its lunge line.
 *
 * This module turns the blade's current pose (hand, angle, reach) plus the
 * attack progress into the ghost slices the renderer strokes. It is pure and
 * Pixi-free so it can be unit tested, and it derives everything from the same
 * blade pose the weapon is already drawn with, so the smear tracks the real
 * weapon rather than a re-simulated one. Nothing here touches the deterministic
 * simulation, replay or export.
 *
 * Convention matches the existing melee FX: the blade trails toward *decreasing*
 * angle (where a fore-to-aft swing came from), and +X is the fighter front.
 */

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Blur length follows blade speed: zero at the ends of the stroke, peak in the middle. */
const strokeSpeed = (progress: number): number => Math.sin(clamp(progress, 0, 1) * Math.PI);

const SWING_MIN_SPAN = 0.14;
const SWING_SPAN_GAIN = 1.5;
const SWING_MAX_SPAN = Math.PI * 0.62;

export interface SwingSmearInput {
  handX: number;
  handY: number;
  /** Current blade direction in radians (already includes the swing rotation). */
  bladeAngle: number;
  /** Hand -> tip length in world units. */
  reach: number;
  /** Attack progress 0..1. */
  progress: number;
  /** Overall strength 0..1 (dimmed for reduced motion). */
  intensity: number;
  /** Ghost slice count (>= 2). */
  samples: number;
}

export interface SmearSlice {
  angle: number;
  radius: number;
  alpha: number;
}

export interface SwingSmearGeometry {
  /** Ghost blades from the current edge (index 0, brightest) back to the oldest (faintest). */
  slices: SmearSlice[];
  /** Total angular length of the trail (> 0). */
  spanRadians: number;
  /** Bright leading blade edge at the current angle. */
  leadTip: Vec2;
}

export function resolveSwingSmear(input: SwingSmearInput): SwingSmearGeometry {
  const reach = Math.max(1, input.reach);
  const samples = Math.max(2, Math.floor(input.samples));
  const speed = strokeSpeed(input.progress);
  const spanRadians = clamp(SWING_MIN_SPAN + speed * SWING_SPAN_GAIN, SWING_MIN_SPAN, SWING_MAX_SPAN);
  const strength = clamp(input.intensity, 0, 1);
  const slices: SmearSlice[] = [];
  for (let i = 0; i < samples; i += 1) {
    const frac = i / (samples - 1);
    const angle = input.bladeAngle - spanRadians * frac;
    // Newest slice is brightest; the trail falls away quickly so it reads as blur, not a fan of solid blades.
    const alpha = strength * Math.pow(1 - frac, 1.6);
    const radius = reach * (1 - frac * 0.05);
    slices.push({ angle, radius, alpha });
  }
  return {
    slices,
    spanRadians,
    leadTip: {
      x: input.handX + Math.cos(input.bladeAngle) * reach,
      y: input.handY + Math.sin(input.bladeAngle) * reach
    }
  };
}

export interface ThrustStreakInput {
  handX: number;
  handY: number;
  /** Thrust direction in radians. */
  thrustAngle: number;
  /** Hand -> tip length in world units. */
  reach: number;
  /** Extra forward reach beyond the tip at peak lunge. */
  extension: number;
  progress: number;
  intensity: number;
  /** Streak segment count (>= 2). */
  samples: number;
}

export interface ThrustStreakSegment {
  /** Distances along the thrust axis from the hand. */
  fromDist: number;
  toDist: number;
  alpha: number;
}

export interface ThrustStreakGeometry {
  axis: Vec2;
  /** Segments from the leading tip (index 0, brightest) receding backward. */
  segments: ThrustStreakSegment[];
  /** Full streak length hand -> current tip. */
  length: number;
  tip: Vec2;
}

export function resolveThrustStreak(input: ThrustStreakInput): ThrustStreakGeometry {
  const reach = Math.max(1, input.reach);
  const samples = Math.max(2, Math.floor(input.samples));
  const speed = strokeSpeed(input.progress);
  const length = reach + Math.max(0, input.extension) * (0.4 + 0.6 * speed);
  const strength = clamp(input.intensity, 0, 1);
  const axis: Vec2 = { x: Math.cos(input.thrustAngle), y: Math.sin(input.thrustAngle) };
  // The lit part of the streak grows with lunge speed; the tail fades out behind the tip.
  const litLength = clamp(length * (0.35 + 0.5 * speed), reach * 0.35, length);
  const segLength = litLength / samples;
  const segments: ThrustStreakSegment[] = [];
  for (let i = 0; i < samples; i += 1) {
    const frac = i / (samples - 1);
    const toDist = length - segLength * i;
    const fromDist = toDist - segLength;
    const alpha = strength * Math.pow(1 - frac, 1.5);
    segments.push({ fromDist, toDist, alpha });
  }
  return {
    axis,
    segments,
    length,
    tip: { x: input.handX + axis.x * length, y: input.handY + axis.y * length }
  };
}
