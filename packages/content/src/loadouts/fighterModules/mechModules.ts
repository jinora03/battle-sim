import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const MECH_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'piston-overdrive',
    name: 'Piston Overdrive',
    description: 'Hydraulic Gauntlet gains 12% damage and 15% knockback, but cycles 7% slower.',
    slot: 'offense',
    compatibleFighterIds: ['mech-bruiser'],
    attachments: [
      parityAttachment({
        id: 'mech-bruiser-piston-overdrive',
        kind: 'ammo-drum',
        mountPoint: 'top',
        primaryColor: 0x303840,
        accentColor: 0xffc35d,
        glowColor: 0xffe49a,
        forward: 0.15,
        lateral: -1.05,
        scale: 1.32,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.12,
      primaryKnockbackMultiplier: 1.15,
      primaryCooldownMultiplier: 1.07
    }
  },
  {
    id: 'reactive-plating',
    name: 'Reactive Plating',
    description: 'Reinforced armor cuts incoming damage by 13% and knockback by 15%, but top speed drops 5%.',
    slot: 'defense',
    compatibleFighterIds: ['mech-bruiser'],
    attachments: [
      parityAttachment({
        id: 'mech-bruiser-reactive-plating',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x37424c,
        accentColor: 0x86d8ff,
        glowColor: 0xc8efff,
        forward: 1.25,
        scale: 1.48,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.87,
      incomingKnockbackMultiplier: 0.85,
      maxSpeedMultiplier: 0.95
    }
  },
  {
    id: 'vector-servos',
    name: 'Vector Servos',
    description: 'High-torque servos increase acceleration by 20% and top speed by 7%, but Mech receives 5% more knockback.',
    slot: 'mobility',
    compatibleFighterIds: ['mech-bruiser'],
    attachments: [
      parityAttachment({
        id: 'mech-bruiser-vector-servos',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x29343d,
        accentColor: 0x64d5ff,
        glowColor: 0xffc45d,
        forward: -1.22,
        scale: 1.34,
      })
    ],
    modifiers: {
      moveAccelerationMultiplier: 1.2,
      maxSpeedMultiplier: 1.07,
      incomingKnockbackMultiplier: 1.05
    }
  },
  {
    id: 'magnet-array',
    name: 'Magnet Array',
    description: 'Magnet Drag gains 16% reach and 14% pull force; Kinetic Pulse gains 8% reach.',
    slot: 'utility',
    compatibleFighterIds: ['mech-bruiser'],
    attachments: [
      parityAttachment({
        id: 'mech-bruiser-magnet-array',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        primaryColor: 0x2b3540,
        accentColor: 0x8de4ff,
        glowColor: 0xffd56d,
        scale: 1.34,
        orbitRadius: 2.18,
        orbitSpeed: 1.0,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'magnet-drag': 1.16,
        'kinetic-pulse': 1.08
      },
      abilityImpulseMultiplier: {
        'magnet-drag': 1.14
      }
    }
  },
];
