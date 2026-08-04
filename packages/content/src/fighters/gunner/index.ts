import fighterRaw from '../../data/fighters/gunner.json';
import aiProfileRaw from '../../data/ai/ranged-gunner.json';
import combatRollRaw from '../../data/abilities/combat-roll.json';
import tacticalSlideRaw from '../../data/abilities/tactical-slide.json';
import suppressiveFireRaw from '../../data/abilities/suppressive-fire.json';
import grenadeLauncherRaw from '../../data/abilities/grenade-launcher.json';
import pinningRoundRaw from '../../data/abilities/pinning-round.json';
import killZoneRaw from '../../data/abilities/kill-zone.json';
import overdriveBarrageRaw from '../../data/abilities/overdrive-barrage.json';
import type { FighterContentBundle } from '../types';

export const gunnerContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [
    combatRollRaw,
    tacticalSlideRaw,
    suppressiveFireRaw,
    grenadeLauncherRaw,
    pinningRoundRaw,
    killZoneRaw,
    overdriveBarrageRaw
  ],
  primaryAttack: {
    id: 'automatic-rifle', name: 'Automatic Rifle', form: 'rifle', behavior: 'automatic', category: 'automatic', style: 'burst',
    range: 720, minRange: 110, damage: 2.8, knockback: 1.2, windupTicks: 4, activeTicks: 10, recoveryTicks: 8,
    cooldownTicks: 38, attackAngleDegrees: 8, visualScale: 1.75, burstCount: 4, burstIntervalTicks: 4, spreadDegrees: 5.2,
    movementAllowed: true, friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
    projectile: { speed: 21, radius: 4.5, lifetimeTicks: 56, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 }
  },
  skillProjectiles: [
    {
      id: 'tactical-round', name: 'Tactical Round', form: 'rifle', behavior: 'ranged', damage: 3.2, knockback: 1.8,
      friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
      projectile: { speed: 23, radius: 4.5, lifetimeTicks: 58, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
      onHitStatuses: [{ statusId: 'target-lock', durationTicks: 180, stacks: 1 }]
    },
    {
      id: 'suppressive-round', name: 'Suppressive Round', form: 'rifle', behavior: 'automatic', damage: 2.25, knockback: 1.2,
      friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
      projectile: { speed: 21.5, radius: 4.3, lifetimeTicks: 64, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
      onHitStatuses: [
        { statusId: 'target-lock', durationTicks: 180, stacks: 1 },
        { statusId: 'suppressed', durationTicks: 54, stacks: 1 }
      ]
    },
    {
      id: 'pinning-round-projectile', name: 'Pinning Round', form: 'rifle', behavior: 'ranged', damage: 9, knockback: 3.6,
      friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
      projectile: { speed: 27, radius: 6, lifetimeTicks: 66, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
      statusInteraction: {
        statusId: 'target-lock',
        bonusDamagePerStack: 3.2,
        bonusKnockbackPerStack: 1.45,
        consumeStacks: 'all',
        applyStatusAtStacks: { minimumStacks: 3, statusId: 'pinned', durationTicks: 72 }
      }
    },
    {
      id: 'kill-zone-round', name: 'Kill Zone Round', form: 'rifle', behavior: 'automatic', damage: 1.55, knockback: 0.72,
      friendlyFire: false, visualId: 'kill-zone-round', audioId: 'gatling-barrage',
      projectile: {
        speed: 29, radius: 3.4, lifetimeTicks: 62, fuseTicks: 0, gravity: 0, bounce: 0,
        explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0,
        homingStrength: 0.045, homingDelayTicks: 0, homingRange: 880, homingTurnRadians: 0.026
      },
      statusInteraction: {
        statusId: 'target-lock',
        bonusDamagePerStack: 0.12,
        bonusKnockbackPerStack: 0.08,
        homingStrengthPerStack: 0.006
      }
    }
  ]
};
