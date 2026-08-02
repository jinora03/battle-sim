import fighterRaw from '../../data/fighters/rocket-vanguard.json';
import aiProfileRaw from '../../data/ai/rocket-artillery.json';
import rocketSalvoRaw from '../../data/abilities/rocket-salvo.json';
import blastJumpRaw from '../../data/abilities/blast-jump.json';
import siegeMarkerRaw from '../../data/abilities/siege-marker.json';
import starburstConvergenceRaw from '../../data/abilities/starburst-convergence.json';
import type { FighterContentBundle } from '../types';

export const rocketContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [rocketSalvoRaw, blastJumpRaw, siegeMarkerRaw, starburstConvergenceRaw],
  primaryAttack: {
    id: 'guided-rocket', name: 'Guided Rocket', form: 'launcher', behavior: 'ranged', category: 'ranged', style: 'shot',
    range: 760, minRange: 150, damage: 5.2, knockback: 3.3, windupTicks: 13, activeTicks: 1, recoveryTicks: 20,
    cooldownTicks: 92, attackAngleDegrees: 18, visualScale: 1.9, movementAllowed: true, friendlyFire: false,
    visualId: 'guided-rocket-launcher', audioId: 'rocket-launch',
    projectile: { speed: 11.4, radius: 10, lifetimeTicks: 122, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 116, explosionDamage: 12.2, explosionImpulse: 12.2, homingStrength: 0.12, homingDelayTicks: 8, homingRange: 720, homingTurnRadians: 0.062, trailStyle: 'smoke' }
  },
  skillProjectiles: [
    {
      id: 'rocket-salvo-missile', name: 'Salvo Missile', form: 'launcher', behavior: 'ranged', damage: 4.1, knockback: 4.6,
      friendlyFire: false, visualId: 'salvo-missile', audioId: 'rocket-launch',
      projectile: { speed: 13.4, radius: 8, lifetimeTicks: 105, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 92, explosionDamage: 6.4, explosionImpulse: 9, homingStrength: 0.12, homingDelayTicks: 9, homingRange: 700, homingTurnRadians: 0.062, trailStyle: 'smoke' }
    },
    {
      id: 'siege-missile', name: 'Siege Missile', form: 'launcher', behavior: 'ranged', damage: 3.2, knockback: 5,
      friendlyFire: false, visualId: 'siege-missile', audioId: 'rocket-launch',
      projectile: { speed: 10.5, radius: 10, lifetimeTicks: 152, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 132, explosionDamage: 8.8, explosionImpulse: 12, homingStrength: 0.105, homingDelayTicks: 18, homingRange: 780, homingTurnRadians: 0.05, trailStyle: 'smoke' }
    },
    {
      id: 'micro-missile', name: 'Micro Missile', form: 'launcher', behavior: 'ranged', damage: 2.0, knockback: 2.5,
      friendlyFire: false, visualId: 'micro-missile', audioId: 'micro-missile',
      projectile: { speed: 11.1, radius: 6, lifetimeTicks: 180, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 72, explosionDamage: 4.8, explosionImpulse: 6.8, homingStrength: 0.17, homingDelayTicks: 24, homingRange: 900, homingTurnRadians: 0.072, trailStyle: 'smoke' }
    }
  ]
};
