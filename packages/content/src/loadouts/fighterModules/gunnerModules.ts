import type { FighterModuleDefinition } from '../../schemas';

export const GUNNER_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'ricochet-chamber',
    name: 'Ricochet Chamber',
    description: 'Primary bullets bounce once from walls and obstacles, but deal 10% less damage.',
    slot: 'offense',
    compatibleFighterIds: ['gunner'],
    modifiers: {
      primaryDamageMultiplier: 0.9,
      primaryProjectileBounce: 0.82,
      primaryProjectileMaxWallBounces: 1
    }
  },
  {
    id: 'piercing-barrel',
    name: 'Piercing Barrel',
    description: 'Primary bullets can pass through one enemy, but the burst cooldown is 12% longer.',
    slot: 'offense',
    compatibleFighterIds: ['gunner'],
    modifiers: {
      primaryCooldownMultiplier: 1.12,
      primaryProjectilePenetration: 1
    }
  },
  {
    id: 'shoulder-missile-pod',
    name: 'Rotary Ammo Drum',
    description: 'A visible rotary feed drum gives Gunner skill rounds 12% more damage and steadier tracking.',
    slot: 'offense',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-shoulder-missile-pod',
        kind: 'ammo-drum',
        mountPoint: 'top',
        rotationMode: 'target',
        forward: 0.32,
        lateral: -1.14,
        scale: 1.48,
        primaryColor: 0x263645,
        accentColor: 0xffc65a,
        glowColor: 0xffd76a,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.072,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      skillProjectileDamageMultiplier: 1.12,
      skillProjectileHomingMultiplier: 1.08
    }
  },
  {
    id: 'deflector-plate',
    name: 'Deflector Plate',
    description: 'Visible armor reduces incoming damage and knockback by 10%, but lowers top speed by 5%.',
    slot: 'defense',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-deflector-plate',
        kind: 'deflector-plate',
        mountPoint: 'front',
        rotationMode: 'body',
        forward: 1.3,
        scale: 1.42,
        primaryColor: 0x31485d,
        accentColor: 0x7de5ff,
        glowColor: 0x65d8ff,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.075,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      incomingDamageMultiplier: 0.9,
      incomingKnockbackMultiplier: 0.9,
      maxSpeedMultiplier: 0.95
    }
  },
  {
    id: 'recoil-thrusters',
    name: 'Recoil Thrusters',
    description: 'Twin rear thrusters increase acceleration by 14% and top speed by 6%, but receive 5% more knockback.',
    slot: 'mobility',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-recoil-thruster-left',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.22,
        lateral: -0.58,
        scale: 1.24,
        primaryColor: 0x263645,
        accentColor: 0x65d8ff,
        glowColor: 0xffd76a,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.068,
        hideInMassBattle: true
      },
      {
        id: 'gunner-recoil-thruster-right',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.22,
        lateral: 0.58,
        scale: 1.24,
        primaryColor: 0x263645,
        accentColor: 0x65d8ff,
        glowColor: 0xffd76a,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.068,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      moveAccelerationMultiplier: 1.14,
      maxSpeedMultiplier: 1.06,
      incomingKnockbackMultiplier: 1.05
    }
  },
  {
    id: 'targeting-drone',
    name: 'Targeting Drone',
    description: 'Target Lock lasts 35% longer and precision skill rounds track more aggressively.',
    slot: 'utility',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-targeting-drone',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        rotationMode: 'orbit',
        scale: 1.36,
        primaryColor: 0x1c3344,
        accentColor: 0xffd76a,
        glowColor: 0x65d8ff,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.07,
        orbitRadius: 2.14,
        orbitSpeed: 1.9,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      statusDurationMultiplier: { 'target-lock': 1.35 },
      skillProjectileHomingMultiplier: 1.2
    }
  }
];
