import { AiController } from '@kinetic/controllers';
import { CONTENT_VERSION, getAbility, listArenas, listFighters, listGameModes } from '@kinetic/content';
import type { AbilitySlot, BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

const requiredSlots: AbilitySlot[] = ['basic', 'skill1', 'skill2', 'skill3', 'ultimate'];
const fighters = listFighters().filter((fighter) => !fighter.classification.traits.includes('custom'));
if (CONTENT_VERSION !== '1.0.0') throw new Error(`Unexpected content version: ${CONTENT_VERSION}`);
if (fighters.length < 8) throw new Error(`Expected at least 8 built-in fighters, received ${fighters.length}`);
for (const fighter of fighters) {
  for (const slot of requiredSlots) {
    const abilityId = fighter.abilitySlots[slot];
    if (!abilityId) throw new Error(`${fighter.id} is missing ${slot}`);
    getAbility(abilityId);
  }
}

function runDuel(seed: number, fighterAId: string, fighterBId: string, arenaId: string) {
  const battle: BattleDefinition = {
    seed,
    arenaId,
    modeId: 'duel',
    participants: [
      { fighterId: fighterAId, team: 1 },
      { fighterId: fighterBId, team: 2 }
    ],
    rules: { friendlyFire: false, teamCollision: 'full', teamCollisionScale: 1, collisionDamageCooldownTicks: 10, maxBattleTicks: 2400 }
  };
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  let activations = 0;
  let resolves = 0;
  let blasts = 0;
  for (let tick = 0; tick < 1800 && !runner.getSnapshot().battleEnded; tick += 1) {
    const events = runner.step(ai.commandsForTick(runner.getSnapshot()));
    activations += events.filter((event) => event.type === 'abilityActivated').length;
    resolves += events.filter((event) => event.type === 'abilityResolved').length;
    blasts += events.filter((event) => event.type === 'blast').length;
  }
  const snapshot = runner.getSnapshot();
  return { fighterAId, fighterBId, arenaId, tick: snapshot.tick, winner: snapshot.winningTeam, activations, resolves, blasts, checksum: checksumSnapshot(snapshot) };
}

const releaseDuels = [
  runDuel(10001, 'water-shaper', 'bomber', 'pillar-court'),
  runDuel(10002, 'pyro-brawler', 'frost-warden', 'cryo-ring'),
  runDuel(10003, 'volt-striker', 'mech-bruiser', 'arc-crucible'),
  runDuel(10004, 'thorn-colossus', 'void-reaper', 'pillar-court')
];
for (const duel of releaseDuels) {
  if (duel.activations <= 0 || duel.resolves <= 0) throw new Error(`No skills resolved in ${duel.fighterAId} vs ${duel.fighterBId}`);
}

function runMixedTeams(seed: number) {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'arc-crucible',
    modeId: 'team-battle',
    participants: [
      { fighterId: 'water-shaper', team: 1 },
      { fighterId: 'frost-warden', team: 1 },
      { fighterId: 'volt-striker', team: 1 },
      { fighterId: 'thorn-colossus', team: 1 },
      { fighterId: 'bomber', team: 2 },
      { fighterId: 'pyro-brawler', team: 2 },
      { fighterId: 'mech-bruiser', team: 2 },
      { fighterId: 'void-reaper', team: 2 }
    ],
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, collisionDamageCooldownTicks: 12, maxBattleTicks: 1800 }
  };
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  let skillStarts = 0;
  let hazardEvents = 0;
  for (let tick = 0; tick < 1200 && !runner.getSnapshot().battleEnded; tick += 1) {
    const events = runner.step(ai.commandsForTick(runner.getSnapshot()));
    skillStarts += events.filter((event) => event.type === 'abilityActivated').length;
    hazardEvents += events.filter((event) => event.type === 'hazardTriggered').length;
  }
  const snapshot = runner.getSnapshot();
  return { tick: snapshot.tick, winner: snapshot.winningTeam, living: snapshot.entities.length, skills: skillStarts, hazards: hazardEvents, checksum: checksumSnapshot(snapshot) };
}

const mixedA = runMixedTeams(101010);
const mixedB = runMixedTeams(101010);
const mixedDifferent = runMixedTeams(101011);
if (mixedA.checksum !== mixedB.checksum) throw new Error('v1.0 mixed-roster determinism failed');
if (mixedA.checksum === mixedDifferent.checksum) throw new Error('Different v1.0 seed did not diverge');

console.log(JSON.stringify({
  phase: '1.0-release',
  contentVersion: CONTENT_VERSION,
  fighters: fighters.length,
  arenas: listArenas().length,
  modes: listGameModes().length,
  fullFiveSlotKits: fighters.length,
  releaseDuels,
  mixedRoster: mixedA,
  mixedRosterRepeat: mixedB,
  mixedRosterDifferentSeed: mixedDifferent
}));
