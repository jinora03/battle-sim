import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const WATER_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'pressure-nozzle',
    name: 'Pressure Nozzle',
    description: 'Pressure Orb gains 10% damage and 12% knockback, but fires 5% slower.',
    slot: 'offense',
    compatibleFighterIds: ['water-shaper'],
    attachments: [
      parityAttachment({
        id: 'water-shaper-pressure-nozzle',
        kind: 'flamethrower',
        mountPoint: 'front',
        primaryColor: 0x17445a,
        accentColor: 0x64dfff,
        glowColor: 0xc9f7ff,
        forward: 1.18,
        scale: 1.1,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.1,
      primaryKnockbackMultiplier: 1.12,
      primaryCooldownMultiplier: 1.05
    }
  },
  {
    id: 'hydro-shell',
    name: 'Hydro Shell',
    description: 'A circulating water shell reduces incoming damage and knockback by 10%, at 4% lower top speed.',
    slot: 'defense',
    compatibleFighterIds: ['water-shaper'],
    attachments: [
      parityAttachment({
        id: 'water-shaper-hydro-shell',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x19475d,
        accentColor: 0x79e6ff,
        glowColor: 0xe1fbff,
        forward: 1.2,
        scale: 1.3,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.9,
      incomingKnockbackMultiplier: 0.9,
      maxSpeedMultiplier: 0.96
    }
  },
  {
    id: 'jetstream-fins',
    name: 'Jetstream Fins',
    description: 'Surge Dash launches 18% harder while acceleration rises 16% and top speed 7%.',
    slot: 'mobility',
    compatibleFighterIds: ['water-shaper'],
    attachments: [
      parityAttachment({
        id: 'water-shaper-jetstream-fins',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x153f54,
        accentColor: 0x55d7ff,
        glowColor: 0xc9f7ff,
        forward: -1.2,
        scale: 1.24,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'surge-dash': 1.18
      },
      moveAccelerationMultiplier: 1.16,
      maxSpeedMultiplier: 1.07
    }
  },
  {
    id: 'undertow-focus',
    name: 'Undertow Focus',
    description: 'Pressure Wave, Undertow and Tidal Cataclysm gain 12% area reach.',
    slot: 'utility',
    compatibleFighterIds: ['water-shaper'],
    attachments: [
      parityAttachment({
        id: 'water-shaper-undertow-focus',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        primaryColor: 0x153e52,
        accentColor: 0x6be2ff,
        glowColor: 0xe3fbff,
        scale: 1.26,
        orbitRadius: 2.12,
        orbitSpeed: 1.25,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'pressure-wave': 1.12,
        undertow: 1.12,
        'tidal-cataclysm': 1.12
      }
    }
  },
];
