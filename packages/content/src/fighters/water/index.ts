import fighterRaw from '../../data/fighters/water-shaper.json';
import aiProfileRaw from '../../data/ai/tidal-controller.json';
import surgeDashRaw from '../../data/abilities/surge-dash.json';
import pressureWaveRaw from '../../data/abilities/pressure-wave.json';
import undertowRaw from '../../data/abilities/undertow.json';
import tidalCataclysmRaw from '../../data/abilities/tidal-cataclysm.json';
import type { FighterContentBundle } from '../types';

export const waterContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [surgeDashRaw, pressureWaveRaw, undertowRaw, tidalCataclysmRaw],
  primaryAttack: {
    id: 'pressure-orb', name: 'Pressure Orb', form: 'water', behavior: 'ranged', category: 'ranged', style: 'shot',
    range: 560, minRange: 55, damage: 12, knockback: 5.5, windupTicks: 7, activeTicks: 1, recoveryTicks: 8,
    cooldownTicks: 28, attackAngleDegrees: 12, visualScale: 1.35, movementAllowed: true, friendlyFire: false,
    visualId: 'pressure-orb', audioId: 'water-shot', onHitStatuses: [{ statusId: 'wet', durationTicks: 100 }],
    projectile: { speed: 16, radius: 9, lifetimeTicks: 72, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 }
  }
};
