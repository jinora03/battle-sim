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
    id: 'flame-fists', name: 'Flame Fists', form: 'fire', behavior: 'melee', category: 'melee', style: 'swing',
    range: 165, minRange: 0, damage: 15, knockback: 6.5, windupTicks: 8, activeTicks: 6, recoveryTicks: 11,
    cooldownTicks: 31, attackAngleDegrees: 125, visualScale: 1.55, movementAllowed: true, friendlyFire: false,
    visualId: 'flame-fists', audioId: 'fire-swipe', onHitStatuses: [{ statusId: 'burn', durationTicks: 100 }]
  }
};
