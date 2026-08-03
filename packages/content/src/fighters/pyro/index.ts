import fighterRaw from '../../data/fighters/pyro-brawler.json';
import aiProfileRaw from '../../data/ai/aggressive-brawler.json';
import magmaDashRaw from '../../data/abilities/magma-dash.json';
import flameRingRaw from '../../data/abilities/flame-ring.json';
import moltenGuardRaw from '../../data/abilities/molten-guard.json';
import infernoCollapseRaw from '../../data/abilities/inferno-collapse.json';
import type { FighterContentBundle } from '../types';

export const pyroContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [magmaDashRaw, flameRingRaw, moltenGuardRaw, infernoCollapseRaw],
  primaryAttack: {
    // Keep the stable id for replay/content compatibility while replacing the
    // old melee Flame Fists behavior with Pyro's short-range flame stream.
    id: 'flame-fists', name: 'Flame Jet', form: 'fire', behavior: 'automatic', category: 'automatic', style: 'stream',
    range: 315, minRange: 0, damage: 5.25, knockback: 1.8, windupTicks: 5, activeTicks: 7, recoveryTicks: 9,
    cooldownTicks: 29, attackAngleDegrees: 28, visualScale: 1.78, burstCount: 3, burstIntervalTicks: 3,
    spreadDegrees: 10, movementAllowed: true, friendlyFire: false,
    visualId: 'flame-fists', audioId: 'fire-swipe',
    projectile: {
      speed: 15.5,
      radius: 8,
      lifetimeTicks: 23,
      fuseTicks: 0,
      gravity: 0,
      bounce: 0,
      explosionRadius: 0,
      explosionDamage: 0,
      explosionImpulse: 0,
      trailStyle: 'spark'
    },
    onHitStatuses: [{ statusId: 'burn', durationTicks: 135, stacks: 1 }]
  }
};
