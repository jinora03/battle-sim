import { afterEach, describe, expect, it } from 'vitest';
import { getFighter, registerFighter, removeCustomFighter } from '@kinetic/content';
import type { SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

const TEST_FIGHTER_ID = 'grenade-launcher-regression-fighter';

afterEach(() => {
  removeCustomFighter(TEST_FIGHTER_ID);
});

function registerGrenadeFighter(): void {
  const base = structuredClone(getFighter('water-shaper'));
  registerFighter({
    ...base,
    id: TEST_FIGHTER_ID,
    name: 'Grenade Launcher Regression Fighter',
    passiveIds: [],
    abilitySlots: { ...base.abilitySlots, skill3: 'grenade-launcher' },
    moduleSlots: {},
    defaultModuleIds: []
  });
}

function run(runner: LocalSimulationRunner, ticks: number, first: SimulationCommand): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    events.push(...runner.step(tick === 0 ? [first] : []));
  }
  return events;
}

describe('Grenade Launcher runtime regression', () => {
  it('centers the explosion on its selected target instead of its caster', () => {
    registerGrenadeFighter();
    const runner = new LocalSimulationRunner({
      seed: 7207,
      arenaId: 'training-grid',
      modeId: 'training',
      participants: [
        { fighterId: TEST_FIGHTER_ID, team: 1, controller: 'player', x: 180, y: 360 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 560, y: 360 },
        { fighterId: 'water-shaper', team: 2, controller: 'player', x: 700, y: 390 }
      ],
      rules: {
        friendlyFire: false,
        teamCollision: 'ghost',
        maxBattleTicks: 1_200,
        training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
      }
    });
    const snapshot = runner.getSnapshot();
    const caster = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.fighterId === 'mech-bruiser')!;
    const events = run(runner, 28, {
      type: 'activateAbility',
      entityId: caster.id,
      slot: 'skill3',
      targetId: target.id,
      direction: { x: 1, y: 0 }
    });

    const blast = events.find((event) => event.type === 'blast' && event.abilityId === 'grenade-launcher');
    const targetDamage = events.find((event) => event.type === 'damage' && event.targetId === target.id);
    expect(blast?.type).toBe('blast');
    expect(targetDamage?.type).toBe('damage');
    if (blast?.type === 'blast' && targetDamage?.type === 'damage' && targetDamage.position) {
      expect(Math.hypot(blast.position.x - targetDamage.position.x, blast.position.y - targetDamage.position.y)).toBeLessThan(1);
    }
    expect(events.some((event) => event.type === 'damage' && event.targetId === caster.id)).toBe(false);
  });
});
