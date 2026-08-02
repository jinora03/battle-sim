import fighterRaw from '../../data/fighters/frost-warden.json';
import aiProfileRaw from '../../data/ai/frost-sentinel.json';
import glacierChargeRaw from '../../data/abilities/glacier-charge.json';
import frostNovaRaw from '../../data/abilities/frost-nova.json';
import iceAnchorRaw from '../../data/abilities/ice-anchor.json';
import absoluteZeroRaw from '../../data/abilities/absolute-zero.json';
import type { FighterContentBundle } from '../types';

export const frostContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [glacierChargeRaw, frostNovaRaw, iceAnchorRaw, absoluteZeroRaw],
  primaryAttack: {
    id: 'frost-halberd', name: 'Frost Halberd', form: 'axe', behavior: 'melee', category: 'melee', style: 'swing',
    range: 210, minRange: 18, damage: 17, knockback: 8.5, windupTicks: 12, activeTicks: 6, recoveryTicks: 15,
    cooldownTicks: 42, attackAngleDegrees: 112, visualScale: 2.05, movementAllowed: true, friendlyFire: false,
    visualId: 'frost-halberd', audioId: 'ice-cleave', onHitStatuses: [{ statusId: 'frozen', durationTicks: 54 }]
  }
};
