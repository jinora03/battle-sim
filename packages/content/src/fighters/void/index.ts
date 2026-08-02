import fighterRaw from '../../data/fighters/void-reaper.json';
import aiProfileRaw from '../../data/ai/void-stalker.json';
import phaseLungeRaw from '../../data/abilities/phase-lunge.json';
import gravityWellRaw from '../../data/abilities/gravity-well.json';
import voidBurstRaw from '../../data/abilities/void-burst.json';
import singularityRaw from '../../data/abilities/singularity.json';
import type { FighterContentBundle } from '../types';

export const voidContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [phaseLungeRaw, gravityWellRaw, voidBurstRaw, singularityRaw],
  primaryAttack: {
    id: 'void-scythe', name: 'Void Scythe', form: 'void', behavior: 'melee', category: 'melee', style: 'swing',
    range: 190, minRange: 10, damage: 16, knockback: 7, windupTicks: 10, activeTicks: 6, recoveryTicks: 13,
    cooldownTicks: 38, attackAngleDegrees: 138, visualScale: 1.9, movementAllowed: true, friendlyFire: false,
    visualId: 'void-scythe', audioId: 'void-cut', onHitStatuses: [{ statusId: 'void-mark', durationTicks: 90 }]
  }
};
