import fighterRaw from '../../data/fighters/ballast.json';
import aiProfileRaw from '../../data/ai/ballast-mass-controller.json';
import featherfallRaw from '../../data/abilities/featherfall.json';
import downbeatRaw from '../../data/abilities/downbeat.json';
import deadWeightRaw from '../../data/abilities/dead-weight.json';
import lastCallRaw from '../../data/abilities/last-call.json';
import type { FighterContentBundle } from '../types';

export const ballastContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [featherfallRaw, downbeatRaw, deadWeightRaw, lastCallRaw],
  primaryAttack: {
    id: 'skip-stone', name: 'Skip Stone', form: 'void', behavior: 'ranged', category: 'ranged', style: 'shot',
    range: 740, minRange: 80, damage: 9, knockback: 6, windupTicks: 8, activeTicks: 1, recoveryTicks: 12,
    cooldownTicks: 52, attackAngleDegrees: 16, visualScale: 1.45, movementAllowed: true, friendlyFire: false,
    visualId: 'skip-stone', audioId: 'void-cut',
    projectile: {
      speed: 14.2,
      radius: 10,
      lifetimeTicks: 112,
      fuseTicks: 0,
      gravity: 0,
      bounce: 0.96,
      maxWallBounces: 3,
      explosionRadius: 0,
      explosionDamage: 0,
      explosionImpulse: 0,
      trailStyle: 'energy'
    },
    onHitStatuses: [{ statusId: 'featherlight', durationTicks: 250, stacks: 1 }]
  }
};
