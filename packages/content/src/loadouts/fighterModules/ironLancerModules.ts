import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const IRON_LANCER_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'penetrator-tip',
    name: 'Penetrator Tip',
    description: 'War Spear strikes deal 9% more damage and Lance Charge launches 12% harder.',
    slot: 'offense',
    compatibleFighterIds: ['iron-lancer'],
    attachments: [parityAttachment({ id: 'iron-lancer-penetrator-tip', kind: 'ammo-drum', mountPoint: 'top', primaryColor: 0x313841, accentColor: 0xffc66d, glowColor: 0xffe0a3, forward: 0.22, lateral: -0.98, scale: 1.08 })],
    modifiers: {
      primaryDamageMultiplier: 1.09,
      abilityImpulseMultiplier: { 'lance-charge': 1.12 }
    }
  },
  {
    id: 'brace-plating',
    name: 'Brace Plating',
    description: 'Reduces incoming knockback by 16% and damage by 8% at a small speed cost.',
    slot: 'defense',
    compatibleFighterIds: ['iron-lancer'],
    attachments: [parityAttachment({ id: 'iron-lancer-brace-plating', kind: 'deflector-plate', mountPoint: 'front', primaryColor: 0x2b333b, accentColor: 0xc7d4df, glowColor: 0xffc66d, forward: 1.2, scale: 1.25 })],
    modifiers: { incomingDamageMultiplier: 0.92, incomingKnockbackMultiplier: 0.84, maxSpeedMultiplier: 0.96 }
  },
  {
    id: 'charge-spurs',
    name: 'Charge Spurs',
    description: 'Lance Charge and Breakthrough self-launch 18% harder and acceleration rises 10%.',
    slot: 'mobility',
    compatibleFighterIds: ['iron-lancer'],
    attachments: [parityAttachment({ id: 'iron-lancer-charge-spurs', kind: 'thruster', mountPoint: 'rear', primaryColor: 0x272f36, accentColor: 0xffa94f, glowColor: 0xffe2a1, forward: -1.22, scale: 1.14 })],
    modifiers: {
      abilitySelfImpulseMultiplier: { 'lance-charge': 1.18, 'breakthrough-charge': 1.18 },
      moveAccelerationMultiplier: 1.1
    }
  },
  {
    id: 'counterweight-shaft',
    name: 'Counterweight Shaft',
    description: 'Pike Sweep and Vault Thrust gain 10% reach and War Spear knockback rises 8%.',
    slot: 'utility',
    compatibleFighterIds: ['iron-lancer'],
    attachments: [parityAttachment({ id: 'iron-lancer-counterweight-shaft', kind: 'ember-satellite', mountPoint: 'orbit', primaryColor: 0x303942, accentColor: 0xffd68a, glowColor: 0xffffff, scale: 0.92, orbitRadius: 1.9, orbitSpeed: 0.85 })],
    modifiers: {
      primaryKnockbackMultiplier: 1.08,
      abilityRadiusMultiplier: { 'pike-sweep': 1.1, 'vault-thrust': 1.1 }
    }
  }
];
