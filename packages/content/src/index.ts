import pyroRaw from './data/fighters/pyro-brawler.json';
import mechRaw from './data/fighters/mech-bruiser.json';
import waterRaw from './data/fighters/water-shaper.json';
import bomberRaw from './data/fighters/bomber.json';
import frostRaw from './data/fighters/frost-warden.json';
import voltRaw from './data/fighters/volt-striker.json';
import thornRaw from './data/fighters/thorn-colossus.json';
import voidRaw from './data/fighters/void-reaper.json';
import gunnerRaw from './data/fighters/gunner.json';
import rocketRaw from './data/fighters/rocket-vanguard.json';
import solarSentinelRaw from './data/fighters/solar-sentinel.json';

import aggressiveRaw from './data/ai/aggressive-brawler.json';
import heavyRaw from './data/ai/heavy-bruiser.json';
import tidalRaw from './data/ai/tidal-controller.json';
import demolitionRaw from './data/ai/demolition-charger.json';
import frostAiRaw from './data/ai/frost-sentinel.json';
import voltAiRaw from './data/ai/volt-hunter.json';
import thornAiRaw from './data/ai/grove-guardian.json';
import voidAiRaw from './data/ai/void-stalker.json';
import gunnerAiRaw from './data/ai/ranged-gunner.json';
import rocketAiRaw from './data/ai/rocket-artillery.json';

import magmaRaw from './data/abilities/magma-dash.json';
import flameRingRaw from './data/abilities/flame-ring.json';
import moltenGuardRaw from './data/abilities/molten-guard.json';
import infernoRaw from './data/abilities/inferno-collapse.json';
import pulseRaw from './data/abilities/kinetic-pulse.json';
import magnetDragRaw from './data/abilities/magnet-drag.json';
import fortifyRaw from './data/abilities/fortify.json';
import overdriveRaw from './data/abilities/reactor-overdrive.json';
import surgeDashRaw from './data/abilities/surge-dash.json';
import pressureWaveRaw from './data/abilities/pressure-wave.json';
import undertowRaw from './data/abilities/undertow.json';
import tidalCataclysmRaw from './data/abilities/tidal-cataclysm.json';
import blastDashRaw from './data/abilities/blast-dash.json';
import concussionBombRaw from './data/abilities/concussion-bomb.json';
import shrapnelBurstRaw from './data/abilities/shrapnel-burst.json';
import megaBombRaw from './data/abilities/mega-bomb.json';
import glacierChargeRaw from './data/abilities/glacier-charge.json';
import frostNovaRaw from './data/abilities/frost-nova.json';
import iceAnchorRaw from './data/abilities/ice-anchor.json';
import absoluteZeroRaw from './data/abilities/absolute-zero.json';
import lightningDashRaw from './data/abilities/lightning-dash.json';
import arcBurstRaw from './data/abilities/arc-burst.json';
import polarityPullRaw from './data/abilities/polarity-pull.json';
import thunderDomeRaw from './data/abilities/thunder-dome.json';
import brambleChargeRaw from './data/abilities/bramble-charge.json';
import seedBurstRaw from './data/abilities/seed-burst.json';
import regenerateRaw from './data/abilities/regenerate.json';
import overgrowthRaw from './data/abilities/overgrowth.json';
import phaseLungeRaw from './data/abilities/phase-lunge.json';
import gravityWellRaw from './data/abilities/gravity-well.json';
import voidBurstRaw from './data/abilities/void-burst.json';
import singularityRaw from './data/abilities/singularity.json';
import combatRollRaw from './data/abilities/combat-roll.json';
import tacticalSlideRaw from './data/abilities/tactical-slide.json';
import suppressiveFireRaw from './data/abilities/suppressive-fire.json';
import grenadeLauncherRaw from './data/abilities/grenade-launcher.json';
import pinningRoundRaw from './data/abilities/pinning-round.json';
import killZoneRaw from './data/abilities/kill-zone.json';
import overdriveBarrageRaw from './data/abilities/overdrive-barrage.json';
import rocketSalvoRaw from './data/abilities/rocket-salvo.json';
import blastJumpRaw from './data/abilities/blast-jump.json';
import siegeMarkerRaw from './data/abilities/siege-marker.json';
import starburstRaw from './data/abilities/starburst-convergence.json';
import solarRushRaw from './data/abilities/solar-rush.json';
import thunderClapRaw from './data/abilities/thunder-clap.json';
import solarAegisRaw from './data/abilities/solar-aegis.json';
import solarLaserRaw from './data/abilities/solar-laser.json';

import burnRaw from './data/statuses/burn.json';
import moltenGuardStatusRaw from './data/statuses/molten-guard.json';
import fortifiedStatusRaw from './data/statuses/fortified.json';
import magmaStatusRaw from './data/statuses/magma-dash.json';
import overdriveStatusRaw from './data/statuses/overdrive.json';
import wetRaw from './data/statuses/wet.json';
import surgeRaw from './data/statuses/surge.json';
import blastDashStatusRaw from './data/statuses/blast-dash.json';
import frozenRaw from './data/statuses/frozen.json';
import cryoGuardRaw from './data/statuses/cryo-guard.json';
import shockedRaw from './data/statuses/shocked.json';
import overchargedRaw from './data/statuses/overcharged.json';
import rootedRaw from './data/statuses/rooted.json';
import barkskinRaw from './data/statuses/barkskin.json';
import phasedRaw from './data/statuses/phased.json';
import voidMarkRaw from './data/statuses/void-mark.json';
import targetLockRaw from './data/statuses/target-lock.json';
import suppressedRaw from './data/statuses/suppressed.json';
import pinnedRaw from './data/statuses/pinned.json';

import ironPitRaw from './data/arenas/iron-pit.json';
import pillarCourtRaw from './data/arenas/pillar-court.json';
import elementalFoundryRaw from './data/arenas/elemental-foundry.json';
import warBasinRaw from './data/arenas/war-basin.json';
import cryoRingRaw from './data/arenas/cryo-ring.json';
import arcCrucibleRaw from './data/arenas/arc-crucible.json';
import trainingGridRaw from './data/arenas/training-grid.json';
import duelRaw from './data/modes/duel.json';
import teamBattleRaw from './data/modes/team-battle.json';
import battleRoyaleRaw from './data/modes/battle-royale.json';
import bossRaidRaw from './data/modes/boss-raid.json';
import survivalRaw from './data/modes/survival.json';
import massSkirmishRaw from './data/modes/mass-skirmish.json';
import trainingRaw from './data/modes/training.json';
import interactionsRaw from './data/element-interactions.json';
import {
  abilitySchema,
  aiProfileSchema,
  arenaSchema,
  elementInteractionSchema,
  fighterSchema,
  gameModeSchema,
  statusSchema,
  type AbilityActivationProfile,
  type AbilityDefinition,
  type AiProfile,
  type ArenaDefinition,
  type ElementInteraction,
  type FighterDefinition,
  type GameModeDefinition,
  type StatusDefinition,
  type AttackForm,
  type PrimaryAttackDefinition,
  type SkillProjectileDefinition,
  type ProjectileSourceDefinition
} from './schemas';
import type { Element } from '@kinetic/protocol';
import { getPassive } from './passives';
import { getFighterModule } from './loadouts';

export * from './schemas';
export * from './passives';
export * from './loadouts';

export const CONTENT_VERSION = '1.2.2-stage8.2a';

const fighters: FighterDefinition[] = [pyroRaw, mechRaw, waterRaw, bomberRaw, frostRaw, voltRaw, thornRaw, voidRaw, gunnerRaw, rocketRaw, solarSentinelRaw].map((raw) => fighterSchema.parse(raw) as FighterDefinition);
const builtinFighterIds = new Set(fighters.map((fighter) => fighter.id));
const customFighterIds = new Set<string>();
const aiProfiles: AiProfile[] = [aggressiveRaw, heavyRaw, tidalRaw, demolitionRaw, frostAiRaw, voltAiRaw, thornAiRaw, voidAiRaw, gunnerAiRaw, rocketAiRaw].map((raw) => aiProfileSchema.parse(raw) as AiProfile);
const abilities: AbilityDefinition[] = [
  magmaRaw, flameRingRaw, moltenGuardRaw, infernoRaw,
  pulseRaw, magnetDragRaw, fortifyRaw, overdriveRaw,
  surgeDashRaw, pressureWaveRaw, undertowRaw, tidalCataclysmRaw,
  blastDashRaw, concussionBombRaw, shrapnelBurstRaw, megaBombRaw,
  glacierChargeRaw, frostNovaRaw, iceAnchorRaw, absoluteZeroRaw,
  lightningDashRaw, arcBurstRaw, polarityPullRaw, thunderDomeRaw,
  brambleChargeRaw, seedBurstRaw, regenerateRaw, overgrowthRaw,
  phaseLungeRaw, gravityWellRaw, voidBurstRaw, singularityRaw,
  combatRollRaw, tacticalSlideRaw, suppressiveFireRaw, grenadeLauncherRaw, pinningRoundRaw, killZoneRaw, overdriveBarrageRaw,
  rocketSalvoRaw, blastJumpRaw, siegeMarkerRaw, starburstRaw,
  solarRushRaw, thunderClapRaw, solarAegisRaw, solarLaserRaw
].map((raw) => abilitySchema.parse(raw) as AbilityDefinition);

const primaryAttacks: PrimaryAttackDefinition[] = [
  {
    id: 'flame-fists', name: 'Flame Fists', form: 'fire', behavior: 'melee', category: 'melee', style: 'swing',
    range: 165, minRange: 0, damage: 15, knockback: 6.5, windupTicks: 8, activeTicks: 6, recoveryTicks: 11,
    cooldownTicks: 31, attackAngleDegrees: 125, visualScale: 1.55, movementAllowed: true, friendlyFire: false,
    visualId: 'flame-fists', audioId: 'fire-swipe', onHitStatuses: [{ statusId: 'burn', durationTicks: 100 }]
  },
  {
    id: 'hydraulic-gauntlet', name: 'Hydraulic Gauntlet', form: 'gauntlet', behavior: 'slam', category: 'slam', style: 'slam',
    range: 150, minRange: 0, damage: 22, knockback: 10.5, windupTicks: 15, activeTicks: 5, recoveryTicks: 18,
    cooldownTicks: 50, attackAngleDegrees: 88, visualScale: 1.6, movementAllowed: false, friendlyFire: false,
    visualId: 'hydraulic-gauntlet', audioId: 'piston-slam'
  },
  {
    id: 'pressure-orb', name: 'Pressure Orb', form: 'water', behavior: 'ranged', category: 'ranged', style: 'shot',
    range: 560, minRange: 55, damage: 12, knockback: 5.5, windupTicks: 7, activeTicks: 1, recoveryTicks: 8,
    cooldownTicks: 28, attackAngleDegrees: 12, visualScale: 1.35, movementAllowed: true, friendlyFire: false,
    visualId: 'pressure-orb', audioId: 'water-shot', onHitStatuses: [{ statusId: 'wet', durationTicks: 100 }],
    projectile: { speed: 16, radius: 9, lifetimeTicks: 72, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 }
  },
  {
    id: 'demolition-bomb', name: 'Impact Bomb', form: 'launcher', behavior: 'throwable', category: 'throwable', style: 'lob',
    range: 570, minRange: 65, damage: 3.8, knockback: 2.4, windupTicks: 11, activeTicks: 1, recoveryTicks: 13,
    cooldownTicks: 92, attackAngleDegrees: 20, visualScale: 1.45, movementAllowed: true, friendlyFire: false,
    visualId: 'bomb-throw', audioId: 'bomb-fuse',
    projectile: { speed: 14.2, radius: 16, lifetimeTicks: 122, fuseTicks: 42, gravity: 0.018, bounce: 0.5, explosionRadius: 138, explosionDamage: 12.2, explosionImpulse: 11.2, homingStrength: 0.07, homingDelayTicks: 7, homingRange: 500, homingTurnRadians: 0.054, trailStyle: 'smoke' }
  },
  {
    id: 'frost-halberd', name: 'Frost Halberd', form: 'axe', behavior: 'melee', category: 'melee', style: 'swing',
    range: 210, minRange: 18, damage: 17, knockback: 8.5, windupTicks: 12, activeTicks: 6, recoveryTicks: 15,
    cooldownTicks: 42, attackAngleDegrees: 112, visualScale: 2.05, movementAllowed: true, friendlyFire: false,
    visualId: 'frost-halberd', audioId: 'ice-cleave', onHitStatuses: [{ statusId: 'frozen', durationTicks: 54 }]
  },
  {
    id: 'arc-emitter', name: 'Arc Emitter', form: 'lightning', behavior: 'ranged', category: 'ranged', style: 'shot',
    range: 590, minRange: 70, damage: 10.5, knockback: 4, windupTicks: 6, activeTicks: 1, recoveryTicks: 8,
    cooldownTicks: 27, attackAngleDegrees: 12, visualScale: 1.4, movementAllowed: true, friendlyFire: false,
    visualId: 'arc-emitter', audioId: 'arc-shot', onHitStatuses: [{ statusId: 'shocked', durationTicks: 45 }],
    projectile: { speed: 19, radius: 7, lifetimeTicks: 65, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 }
  },
  {
    id: 'solar-punch', name: 'Solar Punch', form: 'gauntlet', behavior: 'melee', category: 'melee', style: 'thrust',
    range: 185, minRange: 0, damage: 19, knockback: 9, windupTicks: 8, activeTicks: 5, recoveryTicks: 10,
    cooldownTicks: 31, attackAngleDegrees: 72, visualScale: 1.5, movementAllowed: true, friendlyFire: false,
    visualId: 'solar-punch', audioId: 'solar-impact'
  },
  {
    id: 'automatic-rifle', name: 'Automatic Rifle', form: 'rifle', behavior: 'automatic', category: 'automatic', style: 'burst',
    range: 720, minRange: 110, damage: 3.4, knockback: 1.35, windupTicks: 4, activeTicks: 10, recoveryTicks: 7,
    cooldownTicks: 34, attackAngleDegrees: 8, visualScale: 1.75, burstCount: 4, burstIntervalTicks: 4, spreadDegrees: 5.2,
    movementAllowed: true, friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
    projectile: { speed: 21, radius: 4.5, lifetimeTicks: 56, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 }
  },
  {
    id: 'guided-rocket', name: 'Guided Rocket', form: 'launcher', behavior: 'ranged', category: 'ranged', style: 'shot',
    range: 760, minRange: 150, damage: 5.2, knockback: 3.3, windupTicks: 13, activeTicks: 1, recoveryTicks: 20,
    cooldownTicks: 92, attackAngleDegrees: 18, visualScale: 1.9, movementAllowed: true, friendlyFire: false,
    visualId: 'guided-rocket-launcher', audioId: 'rocket-launch',
    projectile: { speed: 11.4, radius: 10, lifetimeTicks: 122, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 116, explosionDamage: 12.2, explosionImpulse: 12.2, homingStrength: 0.12, homingDelayTicks: 8, homingRange: 720, homingTurnRadians: 0.062, trailStyle: 'smoke' }
  },
  {
    id: 'thorn-claws', name: 'Thorn Claws', form: 'claws', behavior: 'melee', category: 'melee', style: 'swing',
    range: 160, minRange: 0, damage: 13, knockback: 6, windupTicks: 8, activeTicks: 5, recoveryTicks: 12,
    cooldownTicks: 35, attackAngleDegrees: 135, visualScale: 1.45, movementAllowed: true, friendlyFire: false,
    visualId: 'thorn-claws', audioId: 'claw-sweep', onHitStatuses: [{ statusId: 'rooted', durationTicks: 32 }]
  },
  {
    id: 'void-scythe', name: 'Void Scythe', form: 'void', behavior: 'melee', category: 'melee', style: 'swing',
    range: 190, minRange: 10, damage: 16, knockback: 7, windupTicks: 10, activeTicks: 6, recoveryTicks: 13,
    cooldownTicks: 38, attackAngleDegrees: 138, visualScale: 1.9, movementAllowed: true, friendlyFire: false,
    visualId: 'void-scythe', audioId: 'void-cut', onHitStatuses: [{ statusId: 'void-mark', durationTicks: 90 }]
  },
  {
    id: 'war-hammer', name: 'War Hammer', form: 'hammer', behavior: 'melee', category: 'melee', style: 'overhead',
    range: 180, minRange: 0, damage: 20, knockback: 10, windupTicks: 15, activeTicks: 5, recoveryTicks: 17,
    cooldownTicks: 48, attackAngleDegrees: 82, visualScale: 1.7, movementAllowed: false, friendlyFire: false,
    visualId: 'war-hammer', audioId: 'hammer-crush'
  },
  {
    id: 'duelist-sword', name: 'Duelist Sword', form: 'sword', behavior: 'melee', category: 'melee', style: 'swing',
    range: 180, minRange: 0, damage: 15, knockback: 6, windupTicks: 9, activeTicks: 5, recoveryTicks: 12,
    cooldownTicks: 36, attackAngleDegrees: 115, visualScale: 1.7, movementAllowed: true, friendlyFire: false,
    visualId: 'duelist-sword', audioId: 'blade-cut'
  },
  {
    id: 'cyclone-sword', name: 'Cyclone Sword', form: 'sword', behavior: 'spin', category: 'spin', style: 'spin',
    range: 170, minRange: 0, damage: 8, knockback: 4.5, windupTicks: 10, activeTicks: 18, recoveryTicks: 16,
    cooldownTicks: 56, attackAngleDegrees: 360, visualScale: 1.7, movementAllowed: true, friendlyFire: false,
    visualId: 'cyclone-sword', audioId: 'blade-spin'
  },
  {
    id: 'lancer-spear', name: 'Lancer Spear', form: 'spear', behavior: 'melee', category: 'melee', style: 'thrust',
    range: 245, minRange: 25, damage: 15, knockback: 7.5, windupTicks: 11, activeTicks: 5, recoveryTicks: 13,
    cooldownTicks: 40, attackAngleDegrees: 46, visualScale: 2.25, movementAllowed: true, friendlyFire: false,
    visualId: 'lancer-spear', audioId: 'spear-thrust'
  },
  {
    id: 'cyclone-spear', name: 'Cyclone Spear', form: 'spear', behavior: 'spin', category: 'spin', style: 'spin',
    range: 190, minRange: 0, damage: 8.5, knockback: 5, windupTicks: 10, activeTicks: 20, recoveryTicks: 16,
    cooldownTicks: 58, attackAngleDegrees: 360, visualScale: 2.05, movementAllowed: true, friendlyFire: false,
    visualId: 'cyclone-spear', audioId: 'spear-spin'
  }

];

const skillProjectiles: SkillProjectileDefinition[] = [
  {
    id: 'rocket-salvo-missile', name: 'Salvo Missile', form: 'launcher', behavior: 'ranged', damage: 4.1, knockback: 4.6,
    friendlyFire: false, visualId: 'salvo-missile', audioId: 'rocket-launch',
    projectile: { speed: 13.4, radius: 8, lifetimeTicks: 105, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 92, explosionDamage: 6.4, explosionImpulse: 9, homingStrength: 0.12, homingDelayTicks: 9, homingRange: 700, homingTurnRadians: 0.062, trailStyle: 'smoke' }
  },
  {
    id: 'siege-missile', name: 'Siege Missile', form: 'launcher', behavior: 'ranged', damage: 3.2, knockback: 5,
    friendlyFire: false, visualId: 'siege-missile', audioId: 'rocket-launch',
    projectile: { speed: 10.5, radius: 10, lifetimeTicks: 152, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 132, explosionDamage: 8.8, explosionImpulse: 12, homingStrength: 0.105, homingDelayTicks: 18, homingRange: 780, homingTurnRadians: 0.05, trailStyle: 'smoke' }
  },
  {
    id: 'micro-missile', name: 'Micro Missile', form: 'launcher', behavior: 'ranged', damage: 2.0, knockback: 2.5,
    friendlyFire: false, visualId: 'micro-missile', audioId: 'micro-missile',
    projectile: { speed: 11.1, radius: 6, lifetimeTicks: 180, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 72, explosionDamage: 4.8, explosionImpulse: 6.8, homingStrength: 0.17, homingDelayTicks: 24, homingRange: 900, homingTurnRadians: 0.072, trailStyle: 'smoke' }
  },
  {
    id: 'tactical-round', name: 'Tactical Round', form: 'rifle', behavior: 'ranged', damage: 3.2, knockback: 1.8,
    friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
    projectile: { speed: 23, radius: 4.5, lifetimeTicks: 58, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
    onHitStatuses: [{ statusId: 'target-lock', durationTicks: 180, stacks: 1 }]
  },
  {
    id: 'suppressive-round', name: 'Suppressive Round', form: 'rifle', behavior: 'automatic', damage: 2.7, knockback: 1.3,
    friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
    projectile: { speed: 21.5, radius: 4.3, lifetimeTicks: 64, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
    onHitStatuses: [
      { statusId: 'target-lock', durationTicks: 180, stacks: 1 },
      { statusId: 'suppressed', durationTicks: 54, stacks: 1 }
    ]
  },
  {
    id: 'pinning-round-projectile', name: 'Pinning Round', form: 'rifle', behavior: 'ranged', damage: 10, knockback: 4,
    friendlyFire: false, visualId: 'automatic-rifle', audioId: 'rifle-burst',
    projectile: { speed: 27, radius: 6, lifetimeTicks: 66, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 0, explosionDamage: 0, explosionImpulse: 0 },
    statusInteraction: {
      statusId: 'target-lock',
      bonusDamagePerStack: 4.2,
      bonusKnockbackPerStack: 1.8,
      consumeStacks: 'all',
      applyStatusAtStacks: { minimumStacks: 3, statusId: 'pinned', durationTicks: 72 }
    }
  },
  {
    id: 'kill-zone-missile', name: 'Kill Zone Missile', form: 'launcher', behavior: 'ranged', damage: 2.4, knockback: 2.8,
    friendlyFire: false, visualId: 'micro-missile', audioId: 'micro-missile',
    projectile: { speed: 12.4, radius: 6, lifetimeTicks: 190, fuseTicks: 0, gravity: 0, bounce: 0, explosionRadius: 76, explosionDamage: 5.2, explosionImpulse: 7.2, homingStrength: 0.18, homingDelayTicks: 16, homingRange: 920, homingTurnRadians: 0.078, trailStyle: 'smoke' },
    statusInteraction: {
      statusId: 'target-lock',
      bonusDamagePerStack: 1.6,
      bonusKnockbackPerStack: 0.5,
      homingStrengthPerStack: 0.025
    }
  }
];
const statuses: StatusDefinition[] = [burnRaw, moltenGuardStatusRaw, fortifiedStatusRaw, magmaStatusRaw, overdriveStatusRaw, wetRaw, surgeRaw, blastDashStatusRaw, frozenRaw, cryoGuardRaw, shockedRaw, overchargedRaw, rootedRaw, barkskinRaw, phasedRaw, voidMarkRaw, targetLockRaw, suppressedRaw, pinnedRaw]
  .map((raw) => statusSchema.parse(raw) as StatusDefinition);
const arenas: ArenaDefinition[] = [ironPitRaw, pillarCourtRaw, elementalFoundryRaw, warBasinRaw, cryoRingRaw, arcCrucibleRaw, trainingGridRaw].map((raw) => arenaSchema.parse(raw) as ArenaDefinition);
const gameModes: GameModeDefinition[] = [duelRaw, teamBattleRaw, battleRoyaleRaw, bossRaidRaw, survivalRaw, massSkirmishRaw, trainingRaw]
  .map((raw) => gameModeSchema.parse(raw) as GameModeDefinition);
const interactions: ElementInteraction[] = interactionsRaw.map((value) => elementInteractionSchema.parse(value) as ElementInteraction);

const fighterMap = new Map<string, FighterDefinition>(fighters.map((item) => [item.id, item]));
const aiMap = new Map<string, AiProfile>(aiProfiles.map((item) => [item.id, item]));
const abilityMap = new Map<string, AbilityDefinition>(abilities.map((item) => [item.id, item]));
const primaryAttackMap = new Map<string, PrimaryAttackDefinition>(primaryAttacks.map((item) => [item.id, item]));
const skillProjectileMap = new Map<string, SkillProjectileDefinition>(skillProjectiles.map((item) => [item.id, item]));
const statusMap = new Map<string, StatusDefinition>(statuses.map((item) => [item.id, item]));
const arenaMap = new Map<string, ArenaDefinition>(arenas.map((item) => [item.id, item]));
const modeMap = new Map<string, GameModeDefinition>(gameModes.map((item) => [item.id, item]));
const interactionBySource = new Map<Element, Map<Element, number>>();
for (const item of interactions as ElementInteraction[]) {
  let inner = interactionBySource.get(item.source);
  if (!inner) { inner = new Map<Element, number>(); interactionBySource.set(item.source, inner); }
  inner.set(item.target, item.multiplier);
}

function requireFromMap<T>(map: Map<string, T>, id: string, kind: string): T {
  const value = map.get(id);
  if (!value) throw new Error(`Unknown ${kind}: ${id}`);
  return value;
}

export const getFighter = (id: string) => requireFromMap(fighterMap, id, 'fighter');
export const getAiProfile = (id: string) => requireFromMap(aiMap, id, 'AI profile');
export const getAbility = (id: string) => requireFromMap(abilityMap, id, 'ability');
export const getStatus = (id: string) => requireFromMap(statusMap, id, 'status');
export const getPrimaryAttack = (id: string) => requireFromMap(primaryAttackMap, id, 'primary attack');
export const getSkillProjectile = (id: string) => requireFromMap(skillProjectileMap, id, 'skill projectile');

/** Resolves either a fighter primary attack or a skill-owned projectile. */
export function getAttackSource(id: string): PrimaryAttackDefinition | SkillProjectileDefinition {
  return primaryAttackMap.get(id) ?? getSkillProjectile(id);
}

export function getProjectileSource(id: string): ProjectileSourceDefinition {
  const primary = primaryAttackMap.get(id);
  if (primary?.projectile) return primary;
  return getSkillProjectile(id);
}
/** @deprecated Use getPrimaryAttack. */
export const getWeapon = getPrimaryAttack;

/**
 * Returns the reusable activation contract for an ability. Content may override
 * any field, while older definitions receive deterministic defaults derived
 * from their trigger/action composition.
 */
const ABILITY_ACTIVATION_PROFILE_CACHE = new WeakMap<AbilityDefinition, AbilityActivationProfile>();

export function getAbilityActivationProfile(abilityOrId: AbilityDefinition | string, fighterOrId?: FighterDefinition | string | null): AbilityActivationProfile {
  const ability = typeof abilityOrId === 'string' ? getAbility(abilityOrId) : abilityOrId;
  void fighterOrId;
  // The profile is a pure function of the ability definition (the fighter arg is
  // intentionally unused), so memoize per ability object. Re-registered content
  // produces a new object identity and therefore recomputes.
  const cachedProfile = ABILITY_ACTIVATION_PROFILE_CACHE.get(ability);
  if (cachedProfile) return cachedProfile;
  const allActions = ability.triggers.flatMap((trigger) => trigger.actions);
  const activateActions = ability.triggers.filter((trigger) => trigger.event === 'ON_ACTIVATE').flatMap((trigger) => trigger.actions);
  const hasCollision = ability.triggers.some((trigger) => trigger.event === 'ON_COLLISION');
  const hasDirectTarget = allActions.some((action) => action.type === 'DEAL_DAMAGE_TARGET' || action.type === 'APPLY_STATUS_TARGET' || action.type === 'APPLY_KNOCKBACK_TARGET' || action.type === 'EXPLODE_AT_TARGET' || (action.type === 'LAUNCH_PROJECTILES' && action.targetMode !== 'distributed'));
  const hasArea = allActions.some((action) => action.type === 'RADIAL_DAMAGE' || action.type === 'DIRECTIONAL_DAMAGE' || action.type === 'RADIAL_STATUS' || action.type === 'RADIAL_IMPULSE' || action.type === 'EXPLODE' || action.type === 'EXPLODE_AT_TARGET' || (action.type === 'LAUNCH_PROJECTILES' && (action.pattern === 'radial' || action.targetMode === 'distributed')));
  const hasHeal = activateActions.some((action) => action.type === 'HEAL_SELF');
  const hasSelfStatus = activateActions.some((action) => action.type === 'APPLY_STATUS_SELF');
  const hasImpulseSelf = activateActions.some((action) => action.type === 'APPLY_IMPULSE_SELF');
  const hasDamage = allActions.some((action) => action.type === 'DEAL_DAMAGE_TARGET' || action.type === 'RADIAL_DAMAGE' || action.type === 'DIRECTIONAL_DAMAGE' || action.type === 'LAUNCH_PROJECTILES' || ((action.type === 'EXPLODE' || action.type === 'EXPLODE_AT_TARGET') && action.damage > 0));

  let intent: AbilityActivationProfile['intent'] = 'offensive';
  if (!hasDamage && hasHeal) intent = 'defensive';
  else if (!hasDamage && hasSelfStatus && !hasImpulseSelf) intent = 'defensive';
  else if (!hasDamage && hasImpulseSelf) intent = 'movement';
  else if (!hasDamage) intent = 'support';

  let targeting: AbilityActivationProfile['targeting'] = 'target';
  if (intent === 'defensive' || intent === 'support') targeting = 'self';
  else if (hasArea) targeting = 'area';
  else if (intent === 'movement') targeting = 'direction';
  else if (hasDirectTarget || hasCollision) targeting = 'target';

  const radii = allActions.flatMap((action) => {
    if (action.type === 'RADIAL_DAMAGE' || action.type === 'RADIAL_STATUS' || action.type === 'RADIAL_IMPULSE' || action.type === 'EXPLODE' || action.type === 'EXPLODE_AT_TARGET') return [action.radius];
    if (action.type === 'DIRECTIONAL_DAMAGE') return [action.range];
    if (action.type === 'LAUNCH_PROJECTILES') {
      const projectile = getSkillProjectile(action.projectileId);
      return [projectile.projectile.speed * projectile.projectile.lifetimeTicks];
    }
    return [];
  });
  const effectRadius = radii.length > 0 ? Math.max(...radii) : 0;
  const slotPriority: Record<AbilityDefinition['slot'], number> = { basic: 25, skill1: 44, skill2: 54, skill3: 64, ultimate: 80 };
  const derived: AbilityActivationProfile = {
    intent,
    targeting,
    priority: intent === 'defensive' ? 92 : slotPriority[ability.slot],
    minRange: 0,
    maxRange: (targeting === 'self' ? 99999 : targeting === 'area' ? Math.max(80, effectRadius) : targeting === 'direction' ? 540 : hasCollision ? 125 : 260),
    requiresLineOfSight: targeting === 'target' || targeting === 'direction',
    minimumTargets: targeting === 'area' && hasDamage ? 1 : 1,
    collisionWindowTicks: hasCollision ? (ability.slot === 'basic' ? 42 : 100) : 0,
    aimToleranceDegrees: targeting === 'target' || targeting === 'direction' ? 95 : 180
  };
  const profile: AbilityActivationProfile = { ...derived, ...ability.activation };
  ABILITY_ACTIVATION_PROFILE_CACHE.set(ability, profile);
  return profile;
}

export const getArena = (id: string) => requireFromMap(arenaMap, id, 'arena');
export const getGameMode = (id: string) => requireFromMap(modeMap, id, 'game mode');

export function getElementMultiplier(source: Element, targetElements: Element[]): number {
  const inner = interactionBySource.get(source);
  if (!inner) return 1;
  let multiplier = 1;
  for (const target of targetElements) multiplier *= inner.get(target) ?? 1;
  return multiplier;
}

export const ATTACK_FORM_BEHAVIORS: Readonly<Record<AttackForm, readonly PrimaryAttackDefinition['behavior'][]>> = {
  sword: ['melee', 'spin', 'throwable'],
  spear: ['melee', 'spin', 'throwable'],
  hammer: ['melee', 'spin', 'slam', 'throwable'],
  axe: ['melee', 'spin', 'throwable'],
  claws: ['melee', 'spin', 'continuous'],
  rifle: ['ranged', 'automatic', 'continuous', 'beam'],
  launcher: ['ranged', 'throwable'],
  shield: ['melee', 'spin', 'throwable', 'orbit', 'slam'],
  gauntlet: ['melee', 'spin', 'ranged', 'automatic', 'continuous', 'beam', 'slam'],
  fire: ['melee', 'spin', 'ranged', 'automatic', 'continuous', 'beam', 'slam'],
  water: ['melee', 'spin', 'ranged', 'continuous', 'beam', 'orbit'],
  ice: ['melee', 'spin', 'ranged', 'throwable', 'continuous', 'slam'],
  lightning: ['melee', 'ranged', 'automatic', 'continuous', 'beam', 'orbit'],
  nature: ['melee', 'spin', 'ranged', 'throwable', 'continuous', 'slam'],
  void: ['melee', 'spin', 'ranged', 'throwable', 'continuous', 'beam', 'orbit', 'slam']
};

export function isAttackCombinationAllowed(form: AttackForm, behavior: PrimaryAttackDefinition['behavior']): boolean {
  return ATTACK_FORM_BEHAVIORS[form].includes(behavior);
}

function validatePrimaryAttackCatalog(): void {
  const ids = new Set<string>();
  for (const attack of primaryAttacks) {
    if (ids.has(attack.id)) throw new Error(`Duplicate primary attack: ${attack.id}`);
    ids.add(attack.id);
    if (attack.category !== attack.behavior) throw new Error(`Primary attack ${attack.id} has mismatched category and behavior.`);
    if (!isAttackCombinationAllowed(attack.form, attack.behavior)) {
      throw new Error(`Primary attack ${attack.id} uses disallowed ${attack.form} + ${attack.behavior}.`);
    }
    const needsProjectile = ['ranged', 'automatic', 'throwable', 'beam'].includes(attack.behavior);
    if (needsProjectile && !attack.projectile) throw new Error(`Primary attack ${attack.id} requires projectile data.`);
    if (attack.visualScale <= 0 || attack.range <= 0 || attack.cooldownTicks <= 0) {
      throw new Error(`Primary attack ${attack.id} has invalid range, scale, or cooldown.`);
    }
  }
  for (const projectile of skillProjectiles) {
    if (ids.has(projectile.id)) throw new Error(`Duplicate projectile source: ${projectile.id}`);
    ids.add(projectile.id);
    if (!['ranged', 'automatic', 'throwable'].includes(projectile.behavior)) {
      throw new Error(`Skill projectile ${projectile.id} has unsupported behavior ${projectile.behavior}.`);
    }
    if (projectile.projectile.speed <= 0 || projectile.projectile.radius <= 0 || projectile.projectile.lifetimeTicks <= 0) {
      throw new Error(`Skill projectile ${projectile.id} has invalid movement data.`);
    }
  }
}

validatePrimaryAttackCatalog();

export function getPrimaryAttackActivationProfile(attackOrId: PrimaryAttackDefinition | string): AbilityActivationProfile {
  const attack = typeof attackOrId === 'string' ? getPrimaryAttack(attackOrId) : attackOrId;
  return {
    intent: 'offensive',
    targeting: attack.behavior === 'spin' || attack.behavior === 'continuous' || attack.behavior === 'orbit' || attack.behavior === 'slam' ? 'area' : 'target',
    priority: 30,
    minRange: attack.minRange,
    maxRange: attack.range,
    requiresLineOfSight: !['melee', 'spin', 'continuous', 'orbit', 'slam'].includes(attack.behavior),
    minimumTargets: 1,
    collisionWindowTicks: 0,
    aimToleranceDegrees: attack.behavior === 'spin' || attack.behavior === 'orbit' ? 180 : Math.max(15, Math.min(140, attack.attackAngleDegrees / 2 + 35))
  };
}

export interface RegisterFighterOptions {
  replace?: boolean;
}

export function validateFighterReferences(fighter: FighterDefinition): string[] {
  const errors: string[] = [];
  if (fighter.aiProfileId && !aiMap.has(fighter.aiProfileId)) errors.push(`Unknown AI profile: ${fighter.aiProfileId}`);
  for (const [slot, abilityId] of Object.entries(fighter.abilitySlots)) {
    if (abilityId && !abilityMap.has(abilityId)) errors.push(`Unknown ability in ${slot}: ${abilityId}`);
  }
  for (const passiveId of fighter.passiveIds ?? []) {
    try { getPassive(passiveId); } catch { errors.push(`Unknown passive: ${passiveId}`); }
  }
  for (const [slot, moduleIds] of Object.entries(fighter.moduleSlots ?? {})) {
    for (const moduleId of moduleIds ?? []) {
      try {
        const module = getFighterModule(moduleId);
        if (module.slot !== slot) errors.push(`Module ${moduleId} is not a ${slot} module`);
        if (!module.compatibleFighterIds.includes(fighter.id)) errors.push(`Module ${moduleId} is incompatible with ${fighter.id}`);
      } catch { errors.push(`Unknown module: ${moduleId}`); }
    }
  }
  for (const moduleId of fighter.defaultModuleIds ?? []) {
    if (!Object.values(fighter.moduleSlots ?? {}).some((ids) => ids?.includes(moduleId))) errors.push(`Default module is not allowed: ${moduleId}`);
  }
  if (!primaryAttackMap.has(fighter.primaryAttackId)) errors.push(`Unknown primary attack: ${fighter.primaryAttackId}`);
  return errors;
}

export function registerFighter(raw: unknown, options: RegisterFighterOptions = {}): FighterDefinition {
  const fighter = fighterSchema.parse(raw) as FighterDefinition;
  const existing = fighterMap.get(fighter.id);
  if (existing && !options.replace) throw new Error(`Fighter already exists: ${fighter.id}`);
  if (existing && builtinFighterIds.has(fighter.id)) throw new Error(`Built-in fighter IDs cannot be replaced: ${fighter.id}`);
  const referenceErrors = validateFighterReferences(fighter);
  if (referenceErrors.length > 0) throw new Error(referenceErrors.join('\n'));
  const index = fighters.findIndex((item) => item.id === fighter.id);
  if (index >= 0) fighters[index] = fighter;
  else fighters.push(fighter);
  fighterMap.set(fighter.id, fighter);
  customFighterIds.add(fighter.id);
  return fighter;
}

export function removeCustomFighter(id: string): boolean {
  if (!customFighterIds.has(id)) return false;
  customFighterIds.delete(id);
  fighterMap.delete(id);
  const index = fighters.findIndex((fighter) => fighter.id === id);
  if (index >= 0) fighters.splice(index, 1);
  return true;
}

export const hasFighter = (id: string) => fighterMap.has(id);
export const isCustomFighter = (id: string) => customFighterIds.has(id);
export const listFighters = () => [...fighters];
export const listAiProfiles = () => [...aiProfiles];
export const listAbilities = () => [...abilities];
export const listPrimaryAttacks = () => [...primaryAttacks];
/** @deprecated Use listPrimaryAttacks. */
export const listWeapons = listPrimaryAttacks;
export const listArenas = () => [...arenas];
export const listGameModes = () => [...gameModes];
