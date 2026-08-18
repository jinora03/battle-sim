import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const BLADE_VANGUARD_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'honed-edge',
    name: 'Honed Edge',
    description: 'Longsword strikes deal 10% more damage and Driving Slash launches 10% harder.',
    slot: 'offense',
    compatibleFighterIds: ['blade-vanguard'],
    attachments: [parityAttachment({ id: 'blade-vanguard-honed-edge', kind: 'ammo-drum', mountPoint: 'top', primaryColor: 0x273746, accentColor: 0xddeeff, glowColor: 0x75dfff, forward: 0.2, lateral: -0.95, scale: 1.0 })],
    modifiers: {
      primaryDamageMultiplier: 1.1,
      abilityImpulseMultiplier: { 'driving-slash': 1.1 }
    }
  },
  {
    id: 'duelist-guard',
    name: 'Duelist Guard',
    description: 'Reduces incoming damage by 9% and knockback by 10% while keeping the duelist mobile.',
    slot: 'defense',
    compatibleFighterIds: ['blade-vanguard'],
    attachments: [parityAttachment({ id: 'blade-vanguard-duelist-guard', kind: 'deflector-plate', mountPoint: 'front', primaryColor: 0x223140, accentColor: 0xbdd8e8, glowColor: 0x75dfff, forward: 1.18, scale: 1.12 })],
    modifiers: { incomingDamageMultiplier: 0.91, incomingKnockbackMultiplier: 0.9 }
  },
  {
    id: 'lunge-boots',
    name: 'Lunge Boots',
    description: 'Driving Slash accelerates 16% harder and Blade Vanguard gains 7% top speed.',
    slot: 'mobility',
    compatibleFighterIds: ['blade-vanguard'],
    attachments: [parityAttachment({ id: 'blade-vanguard-lunge-boots', kind: 'thruster', mountPoint: 'rear', primaryColor: 0x1a2935, accentColor: 0x64d9ff, glowColor: 0xdff8ff, forward: -1.18, scale: 1.05 })],
    modifiers: {
      abilitySelfImpulseMultiplier: { 'driving-slash': 1.16 },
      maxSpeedMultiplier: 1.07
    }
  },
  {
    id: 'balance-pommel',
    name: 'Balance Pommel',
    description: 'Crosscut and Execution Arc gain 10% reach without increasing their damage.',
    slot: 'utility',
    compatibleFighterIds: ['blade-vanguard'],
    attachments: [parityAttachment({ id: 'blade-vanguard-balance-pommel', kind: 'ember-satellite', mountPoint: 'orbit', primaryColor: 0x243544, accentColor: 0x9deaff, glowColor: 0xffffff, scale: 0.9, orbitRadius: 1.8, orbitSpeed: 1.4 })],
    modifiers: { abilityRadiusMultiplier: { crosscut: 1.1, 'execution-arc': 1.1 } }
  }
];
