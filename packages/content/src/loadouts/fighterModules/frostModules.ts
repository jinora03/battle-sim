import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const FROST_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'razor-rime',
    name: 'Razor Rime',
    description: 'The halberd gains 11% direct damage and Frozen effects last 12% longer.',
    slot: 'offense',
    compatibleFighterIds: ['frost-warden'],
    attachments: [
      parityAttachment({
        id: 'frost-warden-razor-rime',
        kind: 'ammo-drum',
        mountPoint: 'top',
        primaryColor: 0x18354b,
        accentColor: 0x8fe8ff,
        glowColor: 0xe7fbff,
        forward: 0.18,
        lateral: -1.02,
        scale: 1.15,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.11,
      statusDurationMultiplier: {
        frozen: 1.12
      }
    }
  },
  {
    id: 'glacier-plating',
    name: 'Glacier Plating',
    description: 'Heavy ice plating reduces incoming damage by 11% and knockback by 18%, but trims top speed by 5%.',
    slot: 'defense',
    compatibleFighterIds: ['frost-warden'],
    attachments: [
      parityAttachment({
        id: 'frost-warden-glacier-plating',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x173a52,
        accentColor: 0xa9efff,
        glowColor: 0xffffff,
        forward: 1.24,
        scale: 1.42,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.89,
      incomingKnockbackMultiplier: 0.82,
      maxSpeedMultiplier: 0.95
    }
  },
  {
    id: 'ice-runners',
    name: 'Ice Runners',
    description: 'Glacier Charge launches 20% harder while Frost Warden accelerates 15% faster and moves 5% faster.',
    slot: 'mobility',
    compatibleFighterIds: ['frost-warden'],
    attachments: [
      parityAttachment({
        id: 'frost-warden-ice-runners',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x143246,
        accentColor: 0x76ddff,
        glowColor: 0xdffaff,
        forward: -1.2,
        scale: 1.24,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'glacier-charge': 1.2
      },
      moveAccelerationMultiplier: 1.15,
      maxSpeedMultiplier: 1.05
    }
  },
  {
    id: 'permafrost-core',
    name: 'Permafrost Core',
    description: 'Frost Nova and Absolute Zero gain 13% area reach without changing their damage.',
    slot: 'utility',
    compatibleFighterIds: ['frost-warden'],
    attachments: [
      parityAttachment({
        id: 'frost-warden-permafrost-core',
        kind: 'ember-satellite',
        mountPoint: 'orbit',
        primaryColor: 0x142d40,
        accentColor: 0x9deaff,
        glowColor: 0xffffff,
        scale: 1.25,
        orbitRadius: 2.05,
        orbitSpeed: 1.1,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'frost-nova': 1.13,
        'absolute-zero': 1.13
      }
    }
  },
];
