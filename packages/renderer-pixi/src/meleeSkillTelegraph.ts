import type { Vec2 } from '@kinetic/protocol';

/**
 * Weapon-led directional telegraph for melee weapon skills and charges.
 *
 * Stage 9D melee weapon skills (sweeps, thrusts and weapon charges) previously
 * shared the generic concentric "warning-ring" / "directional-stream" telegraphs
 * with ranged and area abilities. A big centred ring behind a duelling fighter
 * reads as a soft bubble and hides the single most important thing a viewer
 * needs before the hit lands: which way the weapon is about to travel.
 *
 * This module derives a sharp, directional telegraph from the *actual* weapon
 * envelope that the swept-contact simulation will use:
 *   - a bounded swept arc for wide swings (the blade fans across its real reach), or
 *   - a forward danger lane + brace anchor for thrusts and committed charges.
 *
 * It is intentionally presentation-only and Pixi-free: it consumes plain
 * geometry inputs (already available from content + the entity snapshot) and
 * returns primitives the renderer strokes. Nothing here influences the
 * deterministic simulation, replay or export.
 *
 * Local convention matches the rest of the renderer: +X is the fighter's front.
 */

/** Signature displacement languages that mark an ability as a melee weapon charge. */
const WEAPON_CHARGE_KNOCKBACK_STYLES: ReadonlySet<string> = new Set([
  'weapon-charge',
  'power-charge',
  'juggernaut',
  'phase-strike'
]);

/** At or above this authored sweep the telegraph fans the blade; below it reads as a thrust lane. */
export const MELEE_SWEEP_ARC_MIN_DEGREES = 60;

/** Arcs never close into a full ring, so a wide ultimate sweep still reads as a slash, not a bubble. */
const MAX_SWEEP_RADIANS = Math.PI * 1.84;
const MIN_SWEEP_RADIANS = 0.35;

export type MeleeTelegraphKind = 'arc' | 'lane';

export interface MeleeTelegraphInput {
  /** Fighter centre in world space. */
  originX: number;
  originY: number;
  /** Facing/cast direction in radians (atan2 of the cast direction). */
  facingRadians: number;
  fighterRadius: number;
  /** Whether the fighter's primary attack is a bladed/pole melee weapon (getMeleeContactProfile != null). */
  primaryIsMeleeWeapon: boolean;
  /** True when the ability has an ON_ACTIVATE MELEE_WEAPON_STRIKE action. */
  hasMeleeWeaponStrike: boolean;
  /** The strike's authored sweep (0 when there is no weapon-strike action). */
  sweepDegrees: number;
  /** True when the ability commits a self-impulse charge (APPLY_IMPULSE_SELF). */
  isCharge: boolean;
  /** getSkillPresentation(abilityId).knockbackStyle, used to confirm a weapon charge identity. */
  knockbackStyle?: string | undefined;
  /** Visible/contact weapon reach in world units (resolveMeleeContactReach). 0 when unknown. */
  weaponReach: number;
  /** Authored telegraph footprint from the skill presentation recipe. */
  telegraphRadius: number;
  /** Cast progress 0..1. */
  progress: number;
}

export interface MeleeTelegraphGeometry {
  kind: MeleeTelegraphKind;
  originX: number;
  originY: number;
  facingRadians: number;
  /** Eased cast progress used for the travelling leading edge. */
  reachProgress: number;
  /** Arc: inner/outer radius of the swept blade band. */
  innerRadius: number;
  outerRadius: number;
  /** Arc: absolute start/end angles and their signed span (always < a full turn). */
  startAngle: number;
  endAngle: number;
  sweepRadians: number;
  /** Arc: current leading-edge angle as the blade fans from start to end. */
  leadAngle: number;
  /** Lane: forward length and half width of the danger lane. */
  laneLength: number;
  laneHalfWidth: number;
  /** Leading weapon point (blade edge / spear tip) at the current progress. */
  tip: Vec2;
  /** Brace anchor just behind the fighter for charge wind-up chevrons. */
  brace: Vec2;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * A melee weapon skill/charge on a fighter that actually holds a bladed or pole
 * weapon. This deliberately excludes body dashes (magma/blast/lightning/surge),
 * bombs, novas, pulls and ranged fire, which keep their existing telegraphs.
 */
export function isMeleeWeaponTelegraph(
  input: Pick<
    MeleeTelegraphInput,
    'primaryIsMeleeWeapon' | 'hasMeleeWeaponStrike' | 'isCharge' | 'knockbackStyle'
  >
): boolean {
  if (!input.primaryIsMeleeWeapon) return false;
  if (input.hasMeleeWeaponStrike) return true;
  return input.isCharge && input.knockbackStyle !== undefined
    && WEAPON_CHARGE_KNOCKBACK_STYLES.has(input.knockbackStyle);
}

export function resolveMeleeTelegraphKind(
  input: Pick<MeleeTelegraphInput, 'hasMeleeWeaponStrike' | 'sweepDegrees'>
): MeleeTelegraphKind {
  return input.hasMeleeWeaponStrike && input.sweepDegrees >= MELEE_SWEEP_ARC_MIN_DEGREES
    ? 'arc'
    : 'lane';
}

export function resolveMeleeTelegraphGeometry(input: MeleeTelegraphInput): MeleeTelegraphGeometry {
  const kind = resolveMeleeTelegraphKind(input);
  const radius = Math.max(1, input.fighterRadius);
  const facing = input.facingRadians;
  const cos = Math.cos(facing);
  const sin = Math.sin(facing);
  const reachProgress = smoothstep(input.progress);
  const footprint = Math.max(radius * 2.2, input.telegraphRadius);
  const brace: Vec2 = { x: input.originX - cos * radius * 0.9, y: input.originY - sin * radius * 0.9 };

  if (kind === 'arc') {
    // Fan the blade across its real contact reach, clamped to the authored
    // footprint so the telegraph never grows larger than before.
    const reach = input.weaponReach > 0 ? input.weaponReach : footprint;
    const outerRadius = clamp(Math.min(reach, footprint), radius * 1.6, footprint);
    const innerRadius = clamp(radius * 0.52, 6, outerRadius * 0.62);
    const sweepRadians = clamp(input.sweepDegrees * Math.PI / 180, MIN_SWEEP_RADIANS, MAX_SWEEP_RADIANS);
    const half = sweepRadians / 2;
    const startAngle = facing - half;
    const endAngle = facing + half;
    const leadAngle = startAngle + sweepRadians * reachProgress;
    return {
      kind,
      originX: input.originX,
      originY: input.originY,
      facingRadians: facing,
      reachProgress,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      sweepRadians,
      leadAngle,
      laneLength: 0,
      laneHalfWidth: 0,
      tip: {
        x: input.originX + Math.cos(leadAngle) * outerRadius,
        y: input.originY + Math.sin(leadAngle) * outerRadius
      },
      brace
    };
  }

  // Lane: a committed forward thrust/charge. The authored telegraph radius is
  // the intended forward projection; the weapon reach keeps very short thrusts
  // from under-selling. The leading tip travels forward as the cast resolves.
  const laneLength = clamp(
    Math.max(footprint, input.weaponReach > 0 ? Math.min(input.weaponReach, footprint) : 0),
    radius * 2.2,
    Math.max(radius * 2.2, input.telegraphRadius)
  );
  const laneHalfWidth = clamp(radius * 0.36, 8, laneLength * 0.24);
  const reachDist = laneLength * reachProgress;
  return {
    kind,
    originX: input.originX,
    originY: input.originY,
    facingRadians: facing,
    reachProgress,
    innerRadius: 0,
    outerRadius: 0,
    startAngle: facing,
    endAngle: facing,
    sweepRadians: 0,
    leadAngle: facing,
    laneLength,
    laneHalfWidth,
    tip: { x: input.originX + cos * reachDist, y: input.originY + sin * reachDist },
    brace
  };
}
