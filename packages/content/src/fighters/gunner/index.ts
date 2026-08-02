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
    range: 720, minRange: 110, damage: 3.4, knockback: 1.35, windupTicks: 4, activeTicks: 10, recoveryTicks: 7,
    cooldownTicks: 34, attackAngleDegrees: 8, visualScale: 1.75, burstCount: 4, burstIntervalTicks: 4, spreadDegrees: 5.2,
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
      id: 'suppressive-round', name: 'Suppressive Round', form: 'rifle', behavior: 'automatic', damage: 2.7, knockback: 1.3,
      friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
      projectile: { speed: 21.5, radius: 4.3, lifetimeTicks: 64, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
      onHitStatuses: [
        { statusId: 'target-lock', durationTicks: 180, stacks: 1 },
        { statusId: 'suppressed', durationTicks: 54, stacks: 1 }
      ]
    },
    {
      id: 'pinning-round-projectile', name: 'Pinning Round', form: 'rifle', behavior: 'ranged', damage: 10, knockback: 4,
      friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
      projectile: { speed: 27, radius: 6, lifetimeTicks: 66, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
      statusInteraction: {
        statusId: 'target-lock',
        bonusDamagePerStack: 4.2,
        bonusKnockbackPerStack: 1.8,
        consumeStacks: 'all',
        applyStatusAtStacks: { minimumStacks: 3, statusId: 'pinned', durationTicks: 72 }
      }
    },
    {
      id: 'kill-zone-missile', name: 'Kill Zone Missile', form: 'launcher', behavior: 'ranged', damage: 2.4, knockback: 2.8,
      friendlyFire: false, visualId: 'micro-missile', audioId: 'micro-missile',
      projectile: { speed: 12.4, radius: 6, lifetimeTicks: 190, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 76, explosionDamage: 5.2, explosionImpulse: 7.2, homingStrength: 0.18, homingDelayTicks: 16, homingRange: 920, homingTurnRadians: 0.078, trailStyle: 'smoke' },
      statusInteraction: {
        statusId: 'target-lock',
        bonusDamagePerStack: 1.6,
        bonusKnockbackPerStack: 0.5,
        homingStrengthPerStack: 0.025
      }
    }
  ]
};
