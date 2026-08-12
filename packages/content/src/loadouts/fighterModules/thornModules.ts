import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const THORN_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'barbed-talons',
    name: 'Barbed Talons',
    description: 'Thorn Claws gain 10% damage and Rooted effects last 15% longer.',
    slot: 'offense',
    compatibleFighterIds: ['thorn-colossus'],
    attachments: [
      parityAttachment({
        id: 'thorn-colossus-barbed-talons',
        kind: 'ammo-drum',
        mountPoint: 'top',
        primaryColor: 0x294124,
        accentColor: 0x8bd15e,
        glowColor: 0xd7ff9d,
        forward: 0.14,
        lateral: -1.05,
        scale: 1.28,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.1,
      statusDurationMultiplier: {
        rooted: 1.15
      }
    }
  },
  {
    id: 'ironbark-plating',
    name: 'Ironbark Plating',
    description: 'Dense bark reduces incoming damage by 12% and knockback by 16%, with 5% lower top speed.',
    slot: 'defense',
    compatibleFighterIds: ['thorn-colossus'],
    attachments: [
      parityAttachment({
        id: 'thorn-colossus-ironbark-plating',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x314628,
        accentColor: 0x9bd36a,
        glowColor: 0xdfffad,
        forward: 1.22,
        scale: 1.5,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.88,
      incomingKnockbackMultiplier: 0.84,
      maxSpeedMultiplier: 0.95
    }
  },
  {
    id: 'vine-springs',
    name: 'Vine Springs',
    description: 'Bramble Charge launches 20% harder while acceleration rises 15% and top speed 5%.',
    slot: 'mobility',
    compatibleFighterIds: ['thorn-colossus'],
    attachments: [
      parityAttachment({
        id: 'thorn-colossus-vine-springs',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x293e24,
        accentColor: 0x77c956,
        glowColor: 0xcfff9a,
        forward: -1.2,
        scale: 1.34,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'bramble-charge': 1.2
      },
      moveAccelerationMultiplier: 1.15,
      maxSpeedMultiplier: 1.05
    }
  },
  {
    id: 'seed-heart',
    name: 'Seed Heart',
    description: "Seed Burst and Overgrowth gain 13% area reach, reinforcing Thorn Colossus' zone-control identity.",
    slot: 'utility',
    compatibleFighterIds: ['thorn-colossus'],
    attachments: [
      parityAttachment({
        id: 'thorn-colossus-seed-heart',
        kind: 'ember-satellite',
        mountPoint: 'orbit',
        primaryColor: 0x2c4325,
        accentColor: 0x91d767,
        glowColor: 0xe6ffb0,
        scale: 1.3,
        orbitRadius: 2.18,
        orbitSpeed: 0.85,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'seed-burst': 1.13,
        overgrowth: 1.13
      }
    }
  },
];
