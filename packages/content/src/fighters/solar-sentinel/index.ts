import fighterRaw from '../../data/fighters/solar-sentinel.json';
import aiProfileRaw from '../../data/ai/aggressive-brawler.json';
import solarRushRaw from '../../data/abilities/solar-rush.json';
import thunderClapRaw from '../../data/abilities/thunder-clap.json';
import solarAegisRaw from '../../data/abilities/solar-aegis.json';
import solarLaserRaw from '../../data/abilities/solar-laser.json';
import type { FighterContentBundle } from '../types';

export const solarSentinelContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [solarRushRaw, thunderClapRaw, solarAegisRaw, solarLaserRaw],
  primaryAttack: {
    id: 'solar-punch', name: 'Solar Punch', form: 'gauntlet', behavior: 'melee', category: 'melee', style: 'thrust',
    range: 185, minRange: 0, damage: 19, knockback: 9, windupTicks: 8, activeTicks: 5, recoveryTicks: 10,
    cooldownTicks: 31, attackAngleDegrees: 72, visualScale: 1.5, movementAllowed: true, friendlyFire: false,
    visualId: 'solar-punch', audioId: 'solar-impact'
  }
};
