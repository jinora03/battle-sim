import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const SOLAR_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'flare-core',
    name: 'Flare Core',
    description: 'Thunder Clap and Solar Eye Beams gain 11% damage, while Solar Punch cycles 5% slower.',
    slot: 'offense',
    compatibleFighterIds: ['solar-sentinel'],
    attachments: [
      parityAttachment({
        id: 'solar-sentinel-flare-core',
        kind: 'ember-satellite',
        mountPoint: 'top',
        rotationMode: 'counter-rotate',
        primaryColor: 0x54351a,
        accentColor: 0xffd56b,
        glowColor: 0xffffff,
        forward: 0.16,
        lateral: -1.02,
        scale: 1.2,
      })
    ],
    modifiers: {
      abilityDamageMultiplier: {
        'thunder-clap': 1.11,
        'solar-laser': 1.11
      },
      primaryCooldownMultiplier: 1.05
    }
  },
  {
    id: 'aegis-plating',
    name: 'Aegis Plating',
    description: 'Solar plating reduces incoming damage by 10% and knockback by 9%, but lowers top speed by 4%.',
    slot: 'defense',
    compatibleFighterIds: ['solar-sentinel'],
    attachments: [
      parityAttachment({
        id: 'solar-sentinel-aegis-plating',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x493719,
        accentColor: 0xffe08a,
        glowColor: 0xffffff,
        forward: 1.25,
        scale: 1.34,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.9,
      incomingKnockbackMultiplier: 0.91,
      maxSpeedMultiplier: 0.96
    }
  },
  {
    id: 'flight-stabilizers',
    name: 'Flight Stabilizers',
    description: 'Sky Rush launches 16% harder while acceleration rises 15% and top speed 6%.',
    slot: 'mobility',
    compatibleFighterIds: ['solar-sentinel'],
    attachments: [
      parityAttachment({
        id: 'solar-sentinel-flight-stabilizers',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x3b321d,
        accentColor: 0xffc84e,
        glowColor: 0xfff1a8,
        forward: -1.2,
        scale: 1.28,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'solar-rush': 1.16
      },
      moveAccelerationMultiplier: 1.15,
      maxSpeedMultiplier: 1.06
    }
  },
  {
    id: 'sun-prism',
    name: 'Sun Prism',
    description: 'Thunder Clap gains 14% reach and Solar Aegis gains 12% defensive-burst reach.',
    slot: 'utility',
    compatibleFighterIds: ['solar-sentinel'],
    attachments: [
      parityAttachment({
        id: 'solar-sentinel-sun-prism',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        primaryColor: 0x45351c,
        accentColor: 0xffe48e,
        glowColor: 0xffffff,
        scale: 1.24,
        orbitRadius: 2.12,
        orbitSpeed: 1.35,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'thunder-clap': 1.14,
        'solar-aegis': 1.12
      }
    }
  },
];
