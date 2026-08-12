import type { FighterModuleDefinition } from '../../schemas';
import { parityAttachment } from './parityVisuals';

export const BOMBER_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'heavy-fuse',
    name: 'Heavy Fuse',
    description: 'Heavier bomb casings trade 8% firing cadence for 14% direct damage and 16% launch force.',
    slot: 'offense',
    compatibleFighterIds: ['bomber'],
    attachments: [
      parityAttachment({
        id: 'bomber-heavy-fuse',
        kind: 'missile-pod',
        mountPoint: 'top',
        rotationMode: 'target',
        primaryColor: 0x33261f,
        accentColor: 0xff8a35,
        glowColor: 0xffd26a,
        forward: 0.12,
        lateral: -1.02,
        scale: 1.22,
      })
    ],
    modifiers: {
      primaryDamageMultiplier: 1.14,
      primaryKnockbackMultiplier: 1.16,
      primaryCooldownMultiplier: 1.08
    }
  },
  {
    id: 'blast-vest',
    name: 'Blast Vest',
    description: 'Layered blast plating cuts incoming damage by 10% and knockback by 12%, at the cost of 4% top speed.',
    slot: 'defense',
    compatibleFighterIds: ['bomber'],
    attachments: [
      parityAttachment({
        id: 'bomber-blast-vest',
        kind: 'deflector-plate',
        mountPoint: 'front',
        primaryColor: 0x3a3029,
        accentColor: 0xffb25b,
        glowColor: 0xff7b2e,
        forward: 1.18,
        scale: 1.34,
      })
    ],
    modifiers: {
      incomingDamageMultiplier: 0.9,
      incomingKnockbackMultiplier: 0.88,
      maxSpeedMultiplier: 0.96
    }
  },
  {
    id: 'detonation-thrusters',
    name: 'Detonation Thrusters',
    description: 'Blast Dash travels 22% farther while Bomber accelerates 12% faster.',
    slot: 'mobility',
    compatibleFighterIds: ['bomber'],
    attachments: [
      parityAttachment({
        id: 'bomber-detonation-thrusters',
        kind: 'thruster',
        mountPoint: 'rear',
        primaryColor: 0x2c2521,
        accentColor: 0xff6b2b,
        glowColor: 0xffdb79,
        forward: -1.2,
        scale: 1.22,
      })
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: {
        'blast-dash': 1.22
      },
      moveAccelerationMultiplier: 1.12
    }
  },
  {
    id: 'cluster-rig',
    name: 'Cluster Rig',
    description: 'Shrapnel Burst reaches 15% farther and MEGA BOMB gains 10% blast reach.',
    slot: 'utility',
    compatibleFighterIds: ['bomber'],
    attachments: [
      parityAttachment({
        id: 'bomber-cluster-rig',
        kind: 'ammo-drum',
        mountPoint: 'orbit',
        primaryColor: 0x2d2522,
        accentColor: 0xff9c4a,
        glowColor: 0xffe08a,
        scale: 1.22,
        orbitRadius: 2.0,
        orbitSpeed: 1.45,
      })
    ],
    modifiers: {
      abilityRadiusMultiplier: {
        'shrapnel-burst': 1.15,
        'mega-bomb': 1.1
      }
    }
  },
];
