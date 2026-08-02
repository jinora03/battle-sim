import fighterRaw from '../../data/fighters/volt-striker.json';
import aiProfileRaw from '../../data/ai/volt-hunter.json';
import lightningDashRaw from '../../data/abilities/lightning-dash.json';
import arcBurstRaw from '../../data/abilities/arc-burst.json';
import polarityPullRaw from '../../data/abilities/polarity-pull.json';
import thunderDomeRaw from '../../data/abilities/thunder-dome.json';
import type { FighterContentBundle } from '../types';

export const voltContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [lightningDashRaw, arcBurstRaw, polarityPullRaw, thunderDomeRaw],
  primaryAttack: {
    id: 'arc-emitter', name: 'Arc Emitter', form: 'lightning', behavior: 'ranged', category: 'ranged', style: 'shot',
    range: 590, minRange: 70, damage: 10.5, knockback: 4, windupTicks: 6, activeTicks: 1, recoveryTicks: 8,
    cooldownTicks: 27, attackAngleDegrees: 12, visualScale: 1.4, movementAllowed: true, friendlyFire: false,
    visualId: 'arc-emitter', audioId: 'arc-shot', onHitStatuses: [{ statusId: 'shocked', durationTicks: 45 }],
    projectile: { speed: 19, radius: 7, lifetimeTicks: 65, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 }
  }
};
