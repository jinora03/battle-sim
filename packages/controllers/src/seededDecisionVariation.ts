import type { AbilityIntent } from '@kinetic/content';
import type { AbilitySlot, EntityId } from '@kinetic/protocol';

export interface AiSelectionContext {
  /** Apply deterministic first-use delays to AI skills at battle start. */
  openingReadiness: boolean;
  /** Changes only after a skill is committed, never once per simulation tick. */
  variationEpoch: number;
}

export interface AiOpeningWindow {
  minTicks: number;
  maxTicks: number;
  category: 'movement' | 'normal' | 'payoff' | 'ultimate';
}

const MOVEMENT_OPENING: AiOpeningWindow = { minTicks: 18, maxTicks: 60, category: 'movement' };
const NORMAL_OPENING: AiOpeningWindow = { minTicks: 30, maxTicks: 120, category: 'normal' };
const PAYOFF_OPENING: AiOpeningWindow = { minTicks: 90, maxTicks: 210, category: 'payoff' };
const ULTIMATE_OPENING: AiOpeningWindow = { minTicks: 300, maxTicks: 480, category: 'ultimate' };
const SCORE_JITTER_MAGNITUDE = 3.25;

/**
 * Universal AI opening cadence at 60 simulation ticks per second.
 * Basics remain immediately available. Movement skills enter earliest, ordinary
 * skills follow, skill-three payoff actions wait longer, and ultimates cannot
 * open a battle before five seconds.
 */
export function getAiOpeningWindow(slot: AbilitySlot, intent: AbilityIntent): AiOpeningWindow {
  if (slot === 'ultimate') return ULTIMATE_OPENING;
  if (intent === 'movement') return MOVEMENT_OPENING;
  if (slot === 'skill3') return PAYOFF_OPENING;
  return NORMAL_OPENING;
}

/**
 * Returns a stable first-use tick without consuming the simulation RNG stream.
 * This avoids changing spawn positions or projectile randomness while still
 * allowing different battle seeds to produce different opening sequences.
 */
export function getAiOpeningReadyTick(
  seed: number,
  entityId: EntityId,
  slot: AbilitySlot,
  abilityId: string,
  intent: AbilityIntent
): number {
  if (slot === 'basic') return 0;
  const window = getAiOpeningWindow(slot, intent);
  return seededInteger(
    seed,
    entityId,
    abilityId,
    `opening:${slot}:${window.category}`,
    window.minTicks,
    window.maxTicks
  );
}

/**
 * Small deterministic score variation for otherwise close ability choices.
 * The epoch is advanced only after the AI commits a skill, so the score does
 * not flicker or reroll every tick while the fighter is considering an action.
 */
export function getAiAbilityScoreJitter(
  seed: number,
  entityId: EntityId,
  abilityId: string,
  variationEpoch: number
): number {
  const unit = seededUnit(seed, entityId, abilityId, `score:${Math.max(0, Math.trunc(variationEpoch))}`);
  return (unit * 2 - 1) * SCORE_JITTER_MAGNITUDE;
}


/** Stable seeded side preference for equivalent corner-escape routes. */
export function getAiCornerEscapeSign(
  seed: number,
  entityId: EntityId,
  cornerKey: string,
  escapeEpoch: number
): -1 | 1 {
  return seededUnit(seed, entityId, cornerKey, `corner-escape:${Math.max(0, Math.trunc(escapeEpoch))}`) < 0.5 ? -1 : 1;
}

function seededInteger(
  seed: number,
  entityId: EntityId,
  abilityId: string,
  salt: string,
  min: number,
  max: number
): number {
  const safeMin = Math.trunc(Math.min(min, max));
  const safeMax = Math.trunc(Math.max(min, max));
  const span = safeMax - safeMin + 1;
  return safeMin + Math.floor(seededUnit(seed, entityId, abilityId, salt) * span);
}

function seededUnit(seed: number, entityId: EntityId, abilityId: string, salt: string): number {
  let hash = 2166136261 ^ (seed >>> 0);
  hash = mixInteger(hash, entityId);
  hash = mixString(hash, abilityId);
  hash = mixString(hash, salt);
  return (hash >>> 0) / 0x100000000;
}

function mixInteger(hash: number, value: number): number {
  let mixed = hash >>> 0;
  const normalized = value >>> 0;
  mixed = Math.imul(mixed ^ (normalized & 0xff), 16777619);
  mixed = Math.imul(mixed ^ ((normalized >>> 8) & 0xff), 16777619);
  mixed = Math.imul(mixed ^ ((normalized >>> 16) & 0xff), 16777619);
  mixed = Math.imul(mixed ^ ((normalized >>> 24) & 0xff), 16777619);
  return mixed >>> 0;
}

function mixString(hash: number, value: string): number {
  let mixed = hash >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    mixed = Math.imul(mixed ^ value.charCodeAt(index), 16777619);
  }
  return mixed >>> 0;
}
