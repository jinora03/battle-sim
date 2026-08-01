import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

// Regression guard for the Stage 7.5 performance pass: the reused active-id
// buffers, spatial/zone-lookup changes and melee candidate handling must leave
// the deterministic command stream and checksum byte-identical at 50v50 scale.
// This complements the 20v20 test in scale-and-teams and the pooled-object
// 50v50 test in stage7-4-performance-phase3 with a full cross-run comparison at
// 100 active fighters — the officially supported ceiling.

function createLargeBattle(seed: number, unitsPerTeam: number): BattleDefinition {
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < unitsPerTeam; index += 1) {
    participants.push({ fighterId: index % 2 === 0 ? 'water-shaper' : 'pyro-brawler', team: 1, controller: 'ai' });
  }
  for (let index = 0; index < unitsPerTeam; index += 1) {
    participants.push({ fighterId: index % 2 === 0 ? 'bomber' : 'mech-bruiser', team: 2, controller: 'ai' });
  }
  return {
    seed,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 5400 }
  };
}

function run(seed: number, unitsPerTeam: number, ticks: number) {
  const runner = new LocalSimulationRunner(createLargeBattle(seed, unitsPerTeam));
  const ai = new AiController();
  let snapshot = runner.getSnapshot();
  let executed = 0;
  for (let index = 0; index < ticks && !snapshot.battleEnded; index += 1) {
    runner.step(ai.commandsForTick(snapshot));
    snapshot = runner.getSnapshot();
    executed += 1;
  }
  return { checksum: checksumSnapshot(snapshot), tick: snapshot.tick, entities: snapshot.entities.length, executed };
}

describe('50v50 large-battle determinism', () => {
  it('reproduces an identical checksum across two 100-fighter runs of the same seed', () => {
    const first = run(0x50f00d, 50, 400);
    const second = run(0x50f00d, 50, 400);
    expect(first.executed).toBeGreaterThan(0);
    expect(second.checksum).toBe(first.checksum);
    expect(second.tick).toBe(first.tick);
    expect(second.entities).toBe(first.entities);
  }, 60_000);

  it('produces a different final checksum for a different seed', () => {
    const a = run(0x50f00d, 50, 300);
    const b = run(0x50f00e, 50, 300);
    expect(a.checksum).not.toBe(b.checksum);
  }, 60_000);
});
