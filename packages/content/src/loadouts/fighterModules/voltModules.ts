import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const VOLT_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'overcharge-emitter',
    name: 'Overcharge Emitter',
    description: 'Arc Emitter gains 10% damage and Shocked effects last 18% longer, with 5% slower firing cadence.',
    slot: 'offense',
    compatibleFighterIds: ['volt-striker'],
    attachments: [
      parityAttachment({
        id: 'volt-striker-overcharge-emitter',
        kind: 'ammo-drum',
        mountPoint: 'top',
        primaryColor: 0x20334a,
        accentColor: 0x5edfff,
        glowColor: 0xd8fbff,
        forward: 0.15,
        lateral: -1.0,
        scale: 1.16,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.1,
      primaryCooldownMultiplier: 1.05,
      statusDurationMultiplier: {
        shocked: 1.18
      }
    }
  },
  {
    id: 'insulated-shell',
    name: 'Insulated Shell',
    description: 'Light armor reduces incoming damage by 9% and knockback by 8%, while trimming top speed by 3%.',
    slot: 'defense',
    compatibleFighterIds: ['volt-striker'],
    attachments: [
      parityAttachment({
        id: 'volt-striker-insulated-shell',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x22384d,
        accentColor: 0x6be6ff,
        glowColor: 0xc9f8ff,
        forward: 1.18,
        scale: 1.25,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.91,
      incomingKnockbackMultiplier: 0.92,
      maxSpeedMultiplier: 0.97
    }
  },
  {
    id: 'arc-capacitors',
    name: 'Arc Capacitors',
    description: 'Lightning Dash launches 20% harder while acceleration rises 14% and top speed 7%.',
    slot: 'mobility',
    compatibleFighterIds: ['volt-striker'],
    attachments: [
      parityAttachment({
        id: 'volt-striker-arc-capacitors',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x1c3043,
        accentColor: 0x57d8ff,
        glowColor: 0xdffcff,
        forward: -1.18,
        scale: 1.2,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'lightning-dash': 1.2
      },
      moveAccelerationMultiplier: 1.14,
      maxSpeedMultiplier: 1.07
    }
  },
  {
    id: 'storm-coil',
    name: 'Storm Coil',
    description: 'Arc Burst and Thunder Dome gain 14% area reach without increasing their direct damage.',
    slot: 'utility',
    compatibleFighterIds: ['volt-striker'],
    attachments: [
      parityAttachment({
        id: 'volt-striker-storm-coil',
        kind: 'ember-satellite',
        mountPoint: 'orbit',
        primaryColor: 0x1c3147,
        accentColor: 0x66e2ff,
        glowColor: 0xffffff,
        scale: 1.24,
        orbitRadius: 2.04,
        orbitSpeed: 1.85,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'arc-burst': 1.14,
        'thunder-dome': 1.14
      }
    }
  },
];
