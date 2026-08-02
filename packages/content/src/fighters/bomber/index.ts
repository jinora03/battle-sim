import fighterRaw from '../../data/fighters/bomber.json';
import aiProfileRaw from '../../data/ai/demolition-charger.json';
import blastDashRaw from '../../data/abilities/blast-dash.json';
import concussionBombRaw from '../../data/abilities/concussion-bomb.json';
import shrapnelBurstRaw from '../../data/abilities/shrapnel-burst.json';
import megaBombRaw from '../../data/abilities/mega-bomb.json';
import type { FighterContentBundle } from '../types';

export const bomberContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [blastDashRaw, concussionBombRaw, shrapnelBurstRaw, megaBombRaw],
  primaryAttack: {
    id: 'demolition-bomb', name: 'Impact Bomb', form: 'launcher', behavior: 'throwable', category: 'throwable', style: 'lob',
    range: 570, minRange: 65, damage: 3.8, knockback: 2.4, windupTicks: 11, activeTicks: 1, recoveryTicks: 13,
    cooldownTicks: 92, attackAngleDegrees: 20, visualScale: 1.45, movementAllowed: true, friendlyFire: false,
    visualId: 'bomb-throw', audioId: 'bomb-fuse',
    projectile: { speed: 14.2, radius: 16, lifetimeTicks: 122, fuseTicks: 42, gravity: 0.018, bounce: 0.5, explosionRadius: 138, explosionDamage: 12.2, explosionImpulse: 11.2, homingStrength: 0.07, homingDelayTicks: 7, homingRange: 500, homingTurnRadians: 0.054, trailStyle: 'smoke' }
  }
};
