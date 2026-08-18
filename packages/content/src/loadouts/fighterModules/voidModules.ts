import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const VOID_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'phase-edge',
    name: 'Phase Edge',
    description: 'Void Scythe gains 11% damage and Void Mark effects last 18% longer.',
    slot: 'offense',
    compatibleFighterIds: ['void-reaper'],
    attachments: [
      parityAttachment({
        id: 'void-reaper-phase-edge',
        kind: 'ammo-drum',
        mountPoint: 'top',
        primaryColor: 0x241a3c,
        accentColor: 0xa37cff,
        glowColor: 0xe7d8ff,
        forward: 0.15,
        lateral: -1.02,
        scale: 1.18,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.11,
      statusDurationMultiplier: {
        'void-mark': 1.18
      }
    }
  },
  {
    id: 'event-horizon-guard',
    name: 'Event Horizon Guard',
    description: 'Compressed void shielding reduces incoming damage and knockback by 10%, at 4% lower top speed.',
    slot: 'defense',
    compatibleFighterIds: ['void-reaper'],
    attachments: [
      parityAttachment({
        id: 'void-reaper-event-horizon-guard',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x291d43,
        accentColor: 0x9e79ee,
        glowColor: 0xc6b1ff,
        forward: 1.2,
        scale: 1.28,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.9,
      incomingKnockbackMultiplier: 0.9,
      maxSpeedMultiplier: 0.96
    }
  },
  {
    id: 'phase-thrusters',
    name: 'Phase Thrusters',
    description: 'Phase Lunge launches 20% harder while acceleration rises 14% and top speed 6%.',
    slot: 'mobility',
    compatibleFighterIds: ['void-reaper'],
    attachments: [
      parityAttachment({
        id: 'void-reaper-phase-thrusters',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x211737,
        accentColor: 0x8c69df,
        glowColor: 0xc4adff,
        forward: -1.18,
        scale: 1.22,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'phase-lunge': 1.2
      },
      moveAccelerationMultiplier: 1.14,
      maxSpeedMultiplier: 1.06
    }
  },
  {
    id: 'gravity-lens',
    name: 'Gravity Lens',
    description: 'Gravity Well and Singularity gain 14% area reach; Gravity Well gains 10% pull force.',
    slot: 'utility',
    compatibleFighterIds: ['void-reaper'],
    attachments: [
      parityAttachment({
        id: 'void-reaper-gravity-lens',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        primaryColor: 0x211634,
        accentColor: 0xa47eff,
        glowColor: 0xd9c8ff,
        scale: 1.28,
        orbitRadius: 2.1,
        orbitSpeed: 1.45,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'gravity-well': 1.14,
        singularity: 1.14
      },
      abilityImpulseMultiplier: {
        'gravity-well': 1.1
      }
    }
  },
];
