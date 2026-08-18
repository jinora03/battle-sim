import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const ROCKET_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'warhead-rack',
    name: 'Warhead Rack',
    description: 'Guided Rocket gains 8% damage and all skill missiles gain 12% damage, with 5% slower primary cadence.',
    slot: 'offense',
    compatibleFighterIds: ['rocket-vanguard'],
    attachments: [
      parityAttachment({
        id: 'rocket-vanguard-warhead-rack',
        kind: 'missile-pod',
        mountPoint: 'top',
        rotationMode: 'target',
        primaryColor: 0x283640,
        accentColor: 0xff7b38,
        glowColor: 0xffd46b,
        forward: 0.18,
        lateral: -1.1,
        scale: 1.42,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.08,
      primaryCooldownMultiplier: 1.05,
      skillProjectileDamageMultiplier: 1.12
    }
  },
  {
    id: 'blast-baffles',
    name: 'Blast Baffles',
    description: 'Reinforced baffles reduce incoming damage by 8% and knockback by 15%, while shaving 4% from top speed.',
    slot: 'defense',
    compatibleFighterIds: ['rocket-vanguard'],
    attachments: [
      parityAttachment({
        id: 'rocket-vanguard-blast-baffles',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x2e3c46,
        accentColor: 0xffb36a,
        glowColor: 0x7fdfff,
        forward: 1.24,
        scale: 1.36,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.92,
      incomingKnockbackMultiplier: 0.85,
      maxSpeedMultiplier: 0.96
    }
  },
  {
    id: 'jump-jets',
    name: 'Jump Jets',
    description: 'Blast Jump launches 25% harder and Rocket Vanguard accelerates 10% faster.',
    slot: 'mobility',
    compatibleFighterIds: ['rocket-vanguard'],
    attachments: [
      parityAttachment({
        id: 'rocket-vanguard-jump-jets',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x25333d,
        accentColor: 0xff6b30,
        glowColor: 0xffdc75,
        forward: -1.23,
        scale: 1.38,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'blast-jump': 1.25
      },
      moveAccelerationMultiplier: 1.1
    }
  },
  {
    id: 'guidance-array',
    name: 'Guidance Array',
    description: 'Skill missiles home 20% harder and Blast Jump gains 12% blast reach.',
    slot: 'utility',
    compatibleFighterIds: ['rocket-vanguard'],
    attachments: [
      parityAttachment({
        id: 'rocket-vanguard-guidance-array',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        primaryColor: 0x22303a,
        accentColor: 0x79dcff,
        glowColor: 0xffc45e,
        scale: 1.3,
        orbitRadius: 2.18,
        orbitSpeed: 1.65,
      })
    ],
    modifiers: {
      skillProjectileHomingMultiplier: 1.2,
      abilityRadiusMultiplier: {
        'blast-jump': 1.12
      }
    }
  },
];
