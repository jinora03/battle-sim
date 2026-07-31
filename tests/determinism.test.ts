import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function run(seed: number, fighterA = 'water-shaper', fighterB = 'bomber'): {
  checksum: string;
  blasts: number;
  starts: number;
  resolves: number;
  sawCastingState: boolean;
  ended: boolean;
} {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: fighterA, team: 1, x: 190, y: 480 },
      { fighterId: fighterB, team: 2, x: 530, y: 480 }
    ]
  };
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  let blasts = 0;
  let starts = 0;
  let resolves = 0;
  let sawCastingState = false;
  for (let i = 0; i < 2400; i += 1) {
    const snapshot = runner.getSnapshot();
    if (snapshot.battleEnded) break;
    sawCastingState ||= snapshot.entities.some((entity) => entity.abilities.some((ability) => ability.phase === 'casting'));
    const events: SimulationEvent[] = runner.step(ai.commandsForTick(snapshot));
    blasts += events.filter((event) => event.type === 'blast').length;
    starts += events.filter((event) => event.type === 'abilityActivated').length;
    resolves += events.filter((event) => event.type === 'abilityResolved').length;
  }
  return { checksum: checksumSnapshot(runner.getSnapshot()), blasts, starts, resolves, sawCastingState, ended: runner.getSnapshot().battleEnded };
}

describe('simulation determinism', () => {
  it('repeats the same seeded Water vs Bomber battle', () => {
    expect(run(4812914).checksum).toBe(run(4812914).checksum);
  });

  it('allows a different seed to produce a different final state', () => {
    expect(run(4812914).checksum).not.toBe(run(4812915).checksum);
  });

  it('exercises telegraphed cast and semantic blast pipelines', () => {
    const result = run(4812914);
    expect(result.sawCastingState).toBe(true);
    expect(result.starts).toBeGreaterThan(0);
    expect(result.resolves).toBeGreaterThan(0);
    expect(result.blasts).toBeGreaterThan(0);
  });
});
