import type { FighterModuleDefinition } from '../../schemas';

/** Developer-authored Pyro modules. All gameplay stays declarative. */
export const PYRO_MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'accelerant-nozzle',
    name: 'Accelerant Nozzle',
    description: 'Flame Jet and Pyro skills apply one extra Burn stack, but Flame Jet deals 12% less direct damage.',
    slot: 'offense',
    compatibleFighterIds: ['pyro-brawler'],
    attachments: [
      {
        id: 'pyro-accelerant-nozzle',
        kind: 'thruster',
        mountPoint: 'front',
        rotationMode: 'body',
        forward: 1.18,
        scale: 0.9,
        primaryColor: 0x541a12,
        accentColor: 0xff6a24,
        glowColor: 0xffe06a,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      primaryDamageMultiplier: 0.88,
      statusStacksAppliedBonus: { burn: 1 }
    }
  },
  {
    id: 'blast-vent',
    name: 'Blast Vent',
    description: 'Combustion gains 18% damage, 24% force and 12% reach.',
    slot: 'offense',
    compatibleFighterIds: ['pyro-brawler'],
    attachments: [
      {
        id: 'pyro-blast-vent',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.22,
        scale: 1.05,
        primaryColor: 0x40120e,
        accentColor: 0xff4b1f,
        glowColor: 0xffd24e,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      abilityDamageMultiplier: { 'molten-guard': 1.18 },
      abilityImpulseMultiplier: { 'molten-guard': 1.24 },
      abilityRadiusMultiplier: { 'molten-guard': 1.12 }
    }
  },
  {
    id: 'furnace-nozzle',
    name: 'Furnace Nozzle',
    description: 'Converts Flame Jet into a sustained cone flamethrower. Pyro keeps 72% movement while channeling and applies Burn at a controlled cadence.',
    slot: 'offense',
    compatibleFighterIds: ['pyro-brawler'],
    attachments: [
      {
        id: 'pyro-furnace-nozzle',
        kind: 'flamethrower',
        mountPoint: 'front',
        rotationMode: 'body',
        forward: 1.18,
        scale: 1.08,
        primaryColor: 0x35130e,
        accentColor: 0xff6a24,
        glowColor: 0xffe16f,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      },
      {
        id: 'pyro-furnace-tank',
        kind: 'flamethrower',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.02,
        lateral: 0.64,
        scale: 0.94,
        primaryColor: 0x2b1512,
        accentColor: 0xd84a1e,
        glowColor: 0xffb83e,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      primaryConeChannel: {
        activeTicks: 72,
        hitIntervalTicks: 6,
        statusIntervalHits: 3,
        rangeMultiplier: 0.95,
        angleDegrees: 36,
        damageMultiplier: 0.68,
        knockbackMultiplier: 0.22,
        movementMultiplier: 0.72
      }
    }
  },
  {
    id: 'thermal-shield',
    name: 'Thermal Shield',
    description: 'At 60% Heat or higher, incoming damage is reduced by 16%.',
    slot: 'defense',
    compatibleFighterIds: ['pyro-brawler'],
    attachments: [
      {
        id: 'pyro-thermal-shield',
        kind: 'deflector-plate',
        mountPoint: 'front',
        rotationMode: 'body',
        forward: 1.28,
        scale: 1.2,
        primaryColor: 0x5a1b13,
        accentColor: 0xff8b31,
        glowColor: 0xffe36b,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.072,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      resourceThresholdIncomingDamageMultiplier: {
        resourceId: 'heat',
        thresholdRatio: 0.6,
        multiplier: 0.84
      }
    }
  },
  {
    id: 'afterburner',
    name: 'Afterburner',
    description: 'Cinder Rush travels 28% farther and its ignition window lasts 30% longer.',
    slot: 'mobility',
    compatibleFighterIds: ['pyro-brawler'],
    attachments: [
      {
        id: 'pyro-afterburner-left',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.2,
        lateral: -0.5,
        scale: 1.0,
        primaryColor: 0x4a1710,
        accentColor: 0xff6a24,
        glowColor: 0xffee85,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.068,
        hideInMassBattle: true
      },
      {
        id: 'pyro-afterburner-right',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.2,
        lateral: 0.5,
        scale: 1.0,
        primaryColor: 0x4a1710,
        accentColor: 0xff6a24,
        glowColor: 0xffee85,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.068,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      abilitySelfImpulseMultiplier: { 'magma-dash': 1.28 },
      statusDurationMultiplier: { 'magma-dash': 1.3 }
    }
  },
  {
    id: 'ember-satellite',
    name: 'Ember Satellite',
    description: 'A visible orbiting ember extends Burn duration and, while Heat is active, spreads Burn around Pyro every two seconds.',
    slot: 'utility',
    compatibleFighterIds: ['pyro-brawler'],
    attachments: [
      {
        id: 'pyro-ember-satellite',
        kind: 'ember-satellite',
        mountPoint: 'orbit',
        rotationMode: 'orbit',
        scale: 1.38,
        primaryColor: 0x4a120d,
        accentColor: 0xff762b,
        glowColor: 0xffe36a,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.07,
        orbitRadius: 2.12,
        orbitSpeed: 1.75,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      statusDurationMultiplier: { burn: 1.2 },
      periodicStatusPulses: [
        {
          statusId: 'burn',
          radius: 210,
          intervalTicks: 120,
          durationTicks: 140,
          stacks: 1,
          resourceId: 'heat',
          minimumResource: 20
        }
      ]
    }
  },
  {
    id: 'overpressure-core',
    name: 'Overpressure Core',
    description: 'Meltdown gains 20% damage and 15% reach, but Heat decays 35% faster.',
    slot: 'utility',
    compatibleFighterIds: ['pyro-brawler'],
    attachments: [
      {
        id: 'pyro-overpressure-core',
        kind: 'ember-satellite',
        mountPoint: 'top',
        rotationMode: 'counter-rotate',
        forward: 0.18,
        lateral: -1.12,
        scale: 1.08,
        primaryColor: 0x35100c,
        accentColor: 0xff4930,
        glowColor: 0xffffff,
        outlineColor: 0xfffbef,
        outlineWidthScale: 0.07,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      abilityDamageMultiplier: { 'inferno-collapse': 1.2 },
      abilityRadiusMultiplier: { 'inferno-collapse': 1.15 },
      resourceDecayMultiplier: { heat: 1.35 }
    }
  }
];
