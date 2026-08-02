import fighterRaw from '../../data/fighters/thorn-colossus.json';
import aiProfileRaw from '../../data/ai/grove-guardian.json';
import brambleChargeRaw from '../../data/abilities/bramble-charge.json';
import seedBurstRaw from '../../data/abilities/seed-burst.json';
import regenerateRaw from '../../data/abilities/regenerate.json';
import overgrowthRaw from '../../data/abilities/overgrowth.json';
import type { FighterContentBundle } from '../types';

export const thornContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [brambleChargeRaw, seedBurstRaw, regenerateRaw, overgrowthRaw],
  primaryAttack: {
    id: 'thorn-claws', name: 'Thorn Claws', form: 'claws', behavior: 'melee', category: 'melee', style: 'swing',
    range: 160, minRange: 0, damage: 13, knockback: 6, windupTicks: 8, activeTicks: 5, recoveryTicks: 12,
    cooldownTicks: 35, attackAngleDegrees: 135, visualScale: 1.45, movementAllowed: true, friendlyFire: false,
    visualId: 'thorn-claws', audioId: 'claw-sweep', onHitStatuses: [{ statusId: 'rooted', durationTicks: 32 }]
  }
};
