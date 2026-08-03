import burnRaw from '../data/statuses/burn.json';
import meltdownRaw from '../data/statuses/meltdown.json';
import moltenGuardStatusRaw from '../data/statuses/molten-guard.json';
import fortifiedStatusRaw from '../data/statuses/fortified.json';
import magmaStatusRaw from '../data/statuses/magma-dash.json';
import overdriveStatusRaw from '../data/statuses/overdrive.json';
import wetRaw from '../data/statuses/wet.json';
import surgeRaw from '../data/statuses/surge.json';
import blastDashStatusRaw from '../data/statuses/blast-dash.json';
import frozenRaw from '../data/statuses/frozen.json';
import cryoGuardRaw from '../data/statuses/cryo-guard.json';
import shockedRaw from '../data/statuses/shocked.json';
import overchargedRaw from '../data/statuses/overcharged.json';
import rootedRaw from '../data/statuses/rooted.json';
import barkskinRaw from '../data/statuses/barkskin.json';
import phasedRaw from '../data/statuses/phased.json';
import voidMarkRaw from '../data/statuses/void-mark.json';
import targetLockRaw from '../data/statuses/target-lock.json';
import suppressedRaw from '../data/statuses/suppressed.json';
import pinnedRaw from '../data/statuses/pinned.json';

import ironPitRaw from '../data/arenas/iron-pit.json';
import pillarCourtRaw from '../data/arenas/pillar-court.json';
import elementalFoundryRaw from '../data/arenas/elemental-foundry.json';
import warBasinRaw from '../data/arenas/war-basin.json';
import cryoRingRaw from '../data/arenas/cryo-ring.json';
import arcCrucibleRaw from '../data/arenas/arc-crucible.json';
import trainingGridRaw from '../data/arenas/training-grid.json';

import duelRaw from '../data/modes/duel.json';
import teamBattleRaw from '../data/modes/team-battle.json';
import battleRoyaleRaw from '../data/modes/battle-royale.json';
import bossRaidRaw from '../data/modes/boss-raid.json';
import survivalRaw from '../data/modes/survival.json';
import massSkirmishRaw from '../data/modes/mass-skirmish.json';
import trainingRaw from '../data/modes/training.json';
import interactionsRaw from '../data/element-interactions.json';

export const STATUS_RAW: readonly unknown[] = [
  burnRaw,
  meltdownRaw,
  moltenGuardStatusRaw,
  fortifiedStatusRaw,
  magmaStatusRaw,
  overdriveStatusRaw,
  wetRaw,
  surgeRaw,
  blastDashStatusRaw,
  frozenRaw,
  cryoGuardRaw,
  shockedRaw,
  overchargedRaw,
  rootedRaw,
  barkskinRaw,
  phasedRaw,
  voidMarkRaw,
  targetLockRaw,
  suppressedRaw,
  pinnedRaw
];

export const ARENA_RAW: readonly unknown[] = [
  ironPitRaw,
  pillarCourtRaw,
  elementalFoundryRaw,
  warBasinRaw,
  cryoRingRaw,
  arcCrucibleRaw,
  trainingGridRaw
];

export const GAME_MODE_RAW: readonly unknown[] = [
  duelRaw,
  teamBattleRaw,
  battleRoyaleRaw,
  bossRaidRaw,
  survivalRaw,
  massSkirmishRaw,
  trainingRaw
];

export const ELEMENT_INTERACTION_RAW: readonly unknown[] = interactionsRaw;
