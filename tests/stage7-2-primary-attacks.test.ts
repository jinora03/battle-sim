import { describe, expect, it } from 'vitest';
import {
  getFighter,
  getPrimaryAttack,
  isAttackCombinationAllowed
} from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function duel(fighterA: string, fighterB: string, ax: number, bx: number, seed = 7202): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: fighterA, team: 1, controller: 'player', x: ax, y: 360 },
      { fighterId: fighterB, team: 2, controller: 'player', x: bx, y: 360 }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 1_200,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  };
  return new LocalSimulationRunner(battle);
}

function run(runner: LocalSimulationRunner, ticks: number, first: SimulationCommand): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runner.step(tick === 0 ? [first] : []));
  return events;
}

describe('v1.1 Stage 7.2 primary attack and fighter identity redesign', () => {
  it('uses one authoritative primary attack for the Basic slot', () => {
    for (const fighterId of ['pyro-brawler', 'thorn-colossus', 'gunner', 'volt-striker']) {
      const fighter = getFighter(fighterId);
      const snapshot = duel(fighterId, 'mech-bruiser', 240, 560).getSnapshot();
      const entity = snapshot.entities.find((item) => item.team === 1)!;
      const basic = entity.abilities.find((ability) => ability.slot === 'basic')!;
      expect(fighter.abilitySlots.basic).toBeUndefined();
      expect(basic.source).toBe('primaryAttack');
      expect(basic.abilityId).toBe(fighter.primaryAttackId);
    }
  });

  it('keeps fighter identities coherent', () => {
    expect(getPrimaryAttack(getFighter('pyro-brawler').primaryAttackId).form).toBe('fire');
    expect(getPrimaryAttack(getFighter('pyro-brawler').primaryAttackId).behavior).toBe('melee');
    expect(getPrimaryAttack(getFighter('thorn-colossus').primaryAttackId).behavior).toBe('melee');
    expect(getPrimaryAttack(getFighter('gunner').primaryAttackId).behavior).toBe('automatic');
    expect(getPrimaryAttack(getFighter('volt-striker').primaryAttackId).form).toBe('lightning');
  });

  it('allows sword and spear spin variants without allowing every form to spin', () => {
    expect(isAttackCombinationAllowed('sword', 'melee')).toBe(true);
    expect(isAttackCombinationAllowed('sword', 'spin')).toBe(true);
    expect(isAttackCombinationAllowed('spear', 'melee')).toBe(true);
    expect(isAttackCombinationAllowed('spear', 'spin')).toBe(true);
    expect(isAttackCombinationAllowed('rifle', 'spin')).toBe(false);
    expect(isAttackCombinationAllowed('launcher', 'spin')).toBe(false);
  });

  it('uses broad effective melee reach instead of requiring body overlap', () => {
    const runner = duel('pyro-brawler', 'water-shaper', 240, 420, 7203);
    const self = runner.getSnapshot().entities.find((entity) => entity.team === 1)!;
    const target = runner.getSnapshot().entities.find((entity) => entity.team === 2)!;
    const centerDistance = Math.hypot(target.x - self.x, target.y - self.y);
    expect(centerDistance).toBeGreaterThan(getPrimaryAttack('flame-fists').range);
    const events = runner.step([{ type: 'activatePrimaryAttack', entityId: self.id, targetId: target.id, direction: { x: 1, y: 0 } }]);
    expect(events.some((event) => event.type === 'weaponAttackStarted' && event.weaponId === 'flame-fists')).toBe(true);
  });

  it('does not let a normal skill implicitly execute the primary attack', () => {
    const runner = duel('pyro-brawler', 'water-shaper', 240, 350, 7204);
    const self = runner.getSnapshot().entities.find((entity) => entity.team === 1)!;
    const target = runner.getSnapshot().entities.find((entity) => entity.team === 2)!;
    const events = run(runner, 20, {
      type: 'activateAbility',
      entityId: self.id,
      slot: 'skill1',
      targetId: target.id,
      direction: { x: 1, y: 0 }
    });
    expect(events.some((event) => event.type === 'abilityActivated' && event.slot === 'skill1')).toBe(true);
    expect(events.some((event) => event.type === 'weaponAttackStarted')).toBe(false);
  });

  it('keeps Gunner skills weapon-related without executing the Basic attack', () => {
    const runner = new LocalSimulationRunner({
      seed: 7206,
      arenaId: 'training-grid',
      modeId: 'training',
      participants: [
        { fighterId: 'gunner', team: 1, controller: 'player', x: 240, y: 360 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 540, y: 360 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 140, y: 360 }
      ],
      rules: {
        friendlyFire: false,
        teamCollision: 'ghost',
        maxBattleTicks: 1_200,
        training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
      }
    });
    const snapshot = runner.getSnapshot();
    const gunner = snapshot.entities.find((entity) => entity.team === 1)!;
    const forward = snapshot.entities.find((entity) => entity.team === 2 && entity.x > gunner.x)!;
    const behind = snapshot.entities.find((entity) => entity.team === 2 && entity.x < gunner.x)!;
    const events = run(runner, 24, {
      type: 'activateAbility', entityId: gunner.id, slot: 'skill2', targetId: forward.id, direction: { x: 1, y: 0 }
    });
    expect(events.some((event) => event.type === 'damage' && event.targetId === forward.id)).toBe(true);
    expect(events.some((event) => event.type === 'damage' && event.targetId === behind.id)).toBe(false);
    expect(events.some((event) => event.type === 'weaponAttackStarted')).toBe(false);
  });


  it('repeats primary attack timing and outcome deterministically', () => {
    const execute = () => {
      const runner = duel('gunner', 'mech-bruiser', 220, 610, 7205);
      const self = runner.getSnapshot().entities.find((entity) => entity.team === 1)!;
      const target = runner.getSnapshot().entities.find((entity) => entity.team === 2)!;
      run(runner, 90, { type: 'activatePrimaryAttack', entityId: self.id, targetId: target.id, direction: { x: 1, y: 0 } });
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(execute()).toBe(execute());
  });
});
