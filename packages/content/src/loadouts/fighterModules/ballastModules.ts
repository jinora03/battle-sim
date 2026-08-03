import type { FighterModuleDefinition } from '../../schemas';

/** Developer-authored Ballast modules built from generic loadout modifiers. */
export const BALLAST_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'polished-stone',
    name: 'Polished Stone',
    description: 'Skip Stone gains two additional ricochets, but deals 10% less direct damage.',
    slot: 'offense',
    compatibleFighterIds: ['ballast'],
    attachments: [
      {
        id: 'ballast-polished-stone',
        kind: 'ember-satellite',
        mountPoint: 'orbit',
        rotationMode: 'orbit',
        scale: 1.18,
        primaryColor: 0x17122b,
        accentColor: 0xbfa7ff,
        glowColor: 0x79ecff,
        outlineColor: 0xffffff,
        outlineWidthScale: 0.07,
        orbitRadius: 1.95,
        orbitSpeed: 1.25,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      primaryDamageMultiplier: 0.9,
      primaryProjectileMaxWallBounces: 2
    }
  },
  {
    id: 'loaded-shaker',
    name: 'Loaded Shaker',
    description: 'Downbeat gains 18% damage and 22% launch force.',
    slot: 'offense',
    compatibleFighterIds: ['ballast'],
    attachments: [
      {
        id: 'ballast-loaded-shaker',
        kind: 'thruster',
        mountPoint: 'front',
        rotationMode: 'body',
        forward: 1.2,
        scale: 1.12,
        primaryColor: 0x21182d,
        accentColor: 0xc5a0ff,
        glowColor: 0x8ef5ff,
        outlineColor: 0xffffff,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      abilityDamageMultiplier: { downbeat: 1.18 },
      abilityImpulseMultiplier: { downbeat: 1.22 }
    }
  },
  {
    id: 'floor-bolts',
    name: 'Floor Bolts',
    description: 'Ballast receives 28% less knockback and keeps Anchored effects 30% longer.',
    slot: 'defense',
    compatibleFighterIds: ['ballast'],
    attachments: [
      {
        id: 'ballast-floor-bolts-left',
        kind: 'deflector-plate',
        mountPoint: 'left',
        rotationMode: 'body',
        lateral: -1.18,
        scale: 1.02,
        primaryColor: 0x241a32,
        accentColor: 0x8a78b8,
        glowColor: 0x72dfff,
        outlineColor: 0xffffff,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      },
      {
        id: 'ballast-floor-bolts-right',
        kind: 'deflector-plate',
        mountPoint: 'right',
        rotationMode: 'body',
        lateral: 1.18,
        scale: 1.02,
        primaryColor: 0x241a32,
        accentColor: 0x8a78b8,
        glowColor: 0x72dfff,
        outlineColor: 0xffffff,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      incomingKnockbackMultiplier: 0.72,
      statusDurationMultiplier: { anchored: 1.3 }
    }
  },
  {
    id: 'rolling-service',
    name: 'Rolling Service',
    description: 'Ballast accelerates 18% faster, moves 8% faster and serves Skip Stone 10% more often.',
    slot: 'mobility',
    compatibleFighterIds: ['ballast'],
    attachments: [
      {
        id: 'ballast-rolling-service',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.18,
        scale: 1.05,
        primaryColor: 0x191226,
        accentColor: 0x8d72c7,
        glowColor: 0x6eeaff,
        outlineColor: 0xffffff,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      moveAccelerationMultiplier: 1.18,
      maxSpeedMultiplier: 1.08,
      primaryCooldownMultiplier: 0.9
    }
  },
  {
    id: 'gravity-caddy',
    name: 'Gravity Caddy',
    description: 'An orbiting caddy applies one Featherlight stack to nearby enemies every 2.5 seconds.',
    slot: 'utility',
    compatibleFighterIds: ['ballast'],
    attachments: [
      {
        id: 'ballast-gravity-caddy',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        rotationMode: 'counter-rotate',
        scale: 1.28,
        primaryColor: 0x181126,
        accentColor: 0xa789e2,
        glowColor: 0x80f2ff,
        outlineColor: 0xffffff,
        outlineWidthScale: 0.07,
        orbitRadius: 2.18,
        orbitSpeed: 1.05,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      periodicStatusPulses: [
        {
          statusId: 'featherlight',
          radius: 190,
          intervalTicks: 150,
          durationTicks: 230,
          stacks: 1
        }
      ]
    }
  },
  {
    id: 'closing-time',
    name: 'Closing Time',
    description: 'Last Call gains 20% damage and 15% arena reach.',
    slot: 'utility',
    compatibleFighterIds: ['ballast'],
    attachments: [
      {
        id: 'ballast-closing-time',
        kind: 'missile-pod',
        mountPoint: 'top',
        rotationMode: 'body',
        forward: 0.15,
        lateral: -1.06,
        scale: 1.0,
        primaryColor: 0x21172e,
        accentColor: 0xc2a3ff,
        glowColor: 0xffffff,
        outlineColor: 0xffffff,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      abilityDamageMultiplier: { 'last-call': 1.2 },
      abilityRadiusMultiplier: { 'last-call': 1.15 }
    }
  }
];
