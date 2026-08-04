import type { AbilityResolvedEvent, BlastEvent, DamageEvent, EntityId, SimulationEvent, WeaponHitEvent } from '@kinetic/protocol';

export type BlastPresentationClass = 'micro-missile' | 'missile-barrage' | 'singular';
export type BlastPresentationDensity = 'hero' | 'crowd';

export interface BlastFeedbackResponse {
  classification: BlastPresentationClass;
  shake: number;
  freezeMs: number;
  screenFlash: number;
}

const MISSILE_WEAPON_IDS = new Set(['guided-rocket', 'rocket-salvo-missile', 'siege-missile', 'micro-missile']);
const MISSILE_ABILITY_IDS = new Set(['rocket-salvo', 'siege-marker', 'starburst-convergence']);

const RAPID_FIRE_WEAPON_IDS = new Set(['automatic-rifle', 'tactical-round', 'suppressive-round', 'kill-zone-round']);

export function isRapidFireWeapon(weaponId: string): boolean {
  return RAPID_FIRE_WEAPON_IDS.has(weaponId);
}

export function isMissileWeapon(weaponId: string): boolean {
  return MISSILE_WEAPON_IDS.has(weaponId) || weaponId.includes('rocket') || weaponId.includes('missile');
}

export function isMissileCascadeAbility(abilityId: string): boolean {
  return MISSILE_ABILITY_IDS.has(abilityId) || isMissileWeapon(abilityId);
}

export function isMissileCascadeFrame(events: readonly SimulationEvent[]): boolean {
  return events.some((event) => {
    if (event.type === 'blast') return isMissileWeapon(event.abilityId ?? '');
    if (event.type === 'projectileSpawned' || event.type === 'projectileImpact' || event.type === 'weaponHit') return isMissileWeapon(event.weaponId);
    return event.type === 'abilityResolved' && isMissileCascadeAbility(event.abilityId);
  });
}

/**
 * Ability Lab can prevent HP loss while still reporting the real damage that
 * would have landed. Presentation must use the amount, not `prevented`, so the
 * same hit flashes, recoil, particles and damage feedback appear in both modes.
 */
export function shouldPresentDamage(event: Pick<DamageEvent, 'amount' | 'prevented'>): boolean {
  return event.amount > 0;
}

export function resolveWeaponHitFreezeMs(event: Pick<WeaponHitEvent, 'weaponId' | 'damage' | 'presentation'>): number {
  if (event.presentation === 'continuous' || isMissileWeapon(event.weaponId) || isRapidFireWeapon(event.weaponId)) return 0;
  return Math.min(42, 6 + event.damage * 1.1);
}

export function resolveUltimateFreezeMs(event: Pick<AbilityResolvedEvent, 'abilityId'>, resolveKind: string): number {
  if (isMissileCascadeAbility(event.abilityId)) return 0;
  return resolveKind === 'mega-bomb' ? 76 : 54;
}

export function classifyBlast(event: Pick<BlastEvent, 'abilityId'>): BlastPresentationClass {
  if (event.abilityId === 'micro-missile') return 'micro-missile';
  if (isMissileWeapon(event.abilityId ?? '')) return 'missile-barrage';
  return 'singular';
}

/**
 * Presentation-only impact policy. Missile swarms deliberately receive little
 * or no hit-stop so a cascade cannot keep the arena visually frozen. Gameplay
 * force, damage and simulation timing are never changed here.
 */
export function resolveBlastFeedback(event: Pick<BlastEvent, 'abilityId' | 'force' | 'radius'>, density: BlastPresentationDensity): BlastFeedbackResponse {
  const classification = classifyBlast(event);
  if (classification === 'micro-missile') {
    return {
      classification,
      shake: Math.min(density === 'crowd' ? 2 : 2.2, event.force * (density === 'crowd' ? 0.14 : 0.16)),
      freezeMs: 0,
      screenFlash: density === 'crowd' ? 0.035 : 0.05
    };
  }
  if (classification === 'missile-barrage') {
    return {
      classification,
      shake: Math.min(density === 'crowd' ? 4.5 : 5, (density === 'crowd' ? 1.3 : 1.5) + event.force * (density === 'crowd' ? 0.24 : 0.28)),
      freezeMs: 0,
      screenFlash: density === 'crowd' ? 0.08 : 0.12
    };
  }
  return {
    classification,
    shake: density === 'crowd'
      ? Math.min(9, 2.5 + event.force * 0.28)
      : Math.min(18, 7 + event.force * 0.55 + event.radius * 0.018),
    freezeMs: density === 'crowd'
      ? Math.min(24, 6 + event.radius * 0.06)
      : Math.min(86, 34 + event.radius * 0.16),
    screenFlash: density === 'crowd'
      ? Math.min(0.2, 0.05 + event.radius / 1_200)
      : Math.min(0.72, 0.22 + event.radius / 650)
  };
}



/**
 * Reduces a missile swarm to a small, readable presentation payload while the
 * full deterministic event stream continues to drive gameplay. A barrage can
 * create dozens of damage, hit, impulse and blast events in one tick; feeding
 * all of those into both VFX engines is a render stall that looks like hit-stop.
 * Three visible launches plus one combined impact/blast preserve the burst read without freezing.
 */
export function compactMissilePresentationEvents(events: readonly SimulationEvent[]): SimulationEvent[] {
  if (!isMissileCascadeFrame(events)) return [...events];

  const missileSources = new Set<EntityId>();
  for (const event of events) {
    if ((event.type === 'projectileSpawned' || event.type === 'projectileImpact' || event.type === 'weaponHit') && isMissileWeapon(event.weaponId)) {
      missileSources.add(event.sourceId);
    } else if (event.type === 'blast' && isMissileWeapon(event.abilityId ?? '') && event.sourceId !== undefined) {
      missileSources.add(event.sourceId);
    }
  }

  const compacted: SimulationEvent[] = [];
  let launches = 0;
  let impacts = 0;
  let blasts = 0;
  let missileDamage = 0;
  let missileKnockback = 0;
  for (const event of events) {
    if (event.type === 'projectileSpawned' && isMissileWeapon(event.weaponId)) {
      if (launches++ < 3) compacted.push(event);
      continue;
    }
    if (event.type === 'projectileImpact' && isMissileWeapon(event.weaponId)) {
      if (impacts++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'blast' && isMissileWeapon(event.abilityId ?? '')) {
      if (blasts++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'weaponHit' && isMissileWeapon(event.weaponId)) continue;
    if (event.type === 'damage' && event.sourceId !== undefined && missileSources.has(event.sourceId)) {
      if (missileDamage++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'knockbackApplied' && event.sourceId !== undefined && missileSources.has(event.sourceId)) {
      if (missileKnockback++ < 1) compacted.push(event);
      continue;
    }
    compacted.push(event);
  }
  return compacted;
}

/**
 * Keeps secondary collision feedback bounded for the lifetime of a missile
 * barrage. The simulation still resolves every collision; only duplicate
 * presentation events are collapsed so a launched target cannot create a new
 * particle/audio spike on every wall or body contact.
 */
export function compactMissileSecondaryPresentationEvents(events: readonly SimulationEvent[]): SimulationEvent[] {
  const compacted: SimulationEvent[] = [];
  let impacts = 0;
  let wallImpacts = 0;
  let obstacleImpacts = 0;
  let deaths = 0;
  let damage = 0;
  let knockback = 0;
  for (const event of events) {
    if (event.type === 'impact') {
      if (impacts++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'wallImpact') {
      if (wallImpacts++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'obstacleImpact') {
      if (obstacleImpacts++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'death') {
      if (deaths++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'damage') {
      if (damage++ < 1) compacted.push(event);
      continue;
    }
    if (event.type === 'knockbackApplied') {
      if (knockback++ < 1) compacted.push(event);
      continue;
    }
    compacted.push(event);
  }
  return compacted;
}

/**
 * Tracks fighters launched by a missile cascade across later simulation ticks.
 * A rocket impact can produce a blast now, then a body collision, wall bounce,
 * obstacle hit or death several frames later. Those secondary events no longer
 * carry a weapon id, so a one-frame `isMissileCascadeFrame` check cannot stop
 * repeated hit-stop. This tracker preserves the causal relationship long
 * enough for the external impulse to settle.
 */
export class MissileCascadeTracker {
  private readonly affectedUntilTick = new Map<EntityId, number>();

  constructor(private readonly lifetimeTicks = 72) {}

  shouldSuppressFreeze(events: readonly SimulationEvent[], tick: number): boolean {
    for (const [entityId, expiry] of this.affectedUntilTick) {
      if (expiry < tick) this.affectedUntilTick.delete(entityId);
    }

    const directMissileFrame = isMissileCascadeFrame(events);
    const affectedThisFrame = new Set<EntityId>();

    for (const event of events) {
      if (event.type === 'weaponHit' && isMissileWeapon(event.weaponId)) {
        affectedThisFrame.add(event.targetId);
      } else if (event.type === 'projectileImpact' && isMissileWeapon(event.weaponId) && event.targetId !== undefined) {
        affectedThisFrame.add(event.targetId);
      }
    }

    if (directMissileFrame) {
      // Explosion damage and impulse events are emitted separately from the
      // projectile event. Treat their targets as part of the same cascade.
      for (const event of events) {
        if (event.type === 'knockbackApplied') affectedThisFrame.add(event.targetId);
        else if (event.type === 'damage') affectedThisFrame.add(event.targetId);
        else if (event.type === 'death') affectedThisFrame.add(event.entityId);
      }
    }

    for (const entityId of affectedThisFrame) {
      this.affectedUntilTick.set(entityId, tick + this.lifetimeTicks);
    }

    if (directMissileFrame) return true;
    for (const event of events) {
      if (event.type === 'wallImpact' || event.type === 'obstacleImpact') {
        if (this.affectedUntilTick.has(event.entityId)) return true;
      } else if (event.type === 'impact') {
        if (this.affectedUntilTick.has(event.a) || this.affectedUntilTick.has(event.b)) return true;
      } else if (event.type === 'death') {
        if (this.affectedUntilTick.has(event.entityId)) return true;
      } else if (event.type === 'damage') {
        if (this.affectedUntilTick.has(event.targetId) || (event.sourceId !== undefined && this.affectedUntilTick.has(event.sourceId))) return true;
      }
    }
    return false;
  }

  reset(): void {
    this.affectedUntilTick.clear();
  }
}
