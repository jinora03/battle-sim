import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function createMassBattle(seed: number): BattleDefinition {
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < 20; index += 1) participants.push({ fighterId: index % 2 === 0 ? 'water-shaper' : 'pyro-brawler', team: 1 });
  for (let index = 0; index < 20; index += 1) participants.push({ fighterId: index % 2 === 0 ? 'bomber' : 'mech-bruiser', team: 2 });
  return {
    seed,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, collisionDamageCooldownTicks: 12, maxBattleTicks: 1800 }
  };
}

function run(seed: number, ticks = 900) {
  const runner = new LocalSimulationRunner(createMassBattle(seed));
  const ai = new AiController();
  let maxCandidates = 0;
  let sameTeamContacts = 0;
  let snapshot = runner.getSnapshot();
  for (let index = 0; index < ticks && !snapshot.battleEnded; index += 1) {
    runner.step(ai.commandsForTick(snapshot));
    snapshot = runner.getSnapshot();
    maxCandidates = Math.max(maxCandidates, snapshot.metrics.candidatePairs);
    sameTeamContacts += snapshot.metrics.sameTeamContacts;
  }
  return { snapshot, checksum: checksumSnapshot(snapshot), maxCandidates, sameTeamContacts };
}

describe('v0.7 multi-fighter scale', () => {
  it('repeats a 20v20 mass skirmish deterministically', () => {
    const first = run(707070);
    const second = run(707070);
    expect(second.checksum).toBe(first.checksum);
    expect(second.snapshot.tick).toBe(first.snapshot.tick);
    expect(first.snapshot.entities.length).toBeGreaterThan(0);
  }, 20_000);

  it('uses the spatial broadphase and soft ally contacts', () => {
    const result = run(707071, 360);
    expect(result.maxCandidates).toBeLessThan(780); // all-pairs for 40 entities is 780 every tick
    expect(result.sameTeamContacts).toBeGreaterThan(0);
    expect(result.snapshot.metrics.activeEntities).toBe(result.snapshot.entities.length);
  });

  it('does not damage allies when friendly fire is disabled', () => {
    const battle: BattleDefinition = {
      seed: 17,
      arenaId: 'pillar-court',
      modeId: 'team-battle',
      participants: [
        { fighterId: 'bomber', team: 1, x: 300, y: 470 },
        { fighterId: 'water-shaper', team: 1, x: 335, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, x: 690, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, x: 730, y: 470 }
      ],
      rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.2, collisionDamageCooldownTicks: 10, maxBattleTicks: 600 }
    };
    const runner = new LocalSimulationRunner(battle);
    const initial = runner.getSnapshot().entities.filter((entity) => entity.team === 1).map((entity) => entity.hp);
    for (let index = 0; index < 12; index += 1) runner.step([]);
    const after = runner.getSnapshot().entities.filter((entity) => entity.team === 1).map((entity) => entity.hp);
    expect(after).toEqual(initial);
  });
});
