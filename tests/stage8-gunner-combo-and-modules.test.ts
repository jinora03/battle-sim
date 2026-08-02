import { describe, expect, it } from 'vitest';
import {
  getAbility,
  getFighter,
  getPassive,
  listCompatibleModules,
  resolveFighterLoadout
} from '@kinetic/content';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function runTicks(
  runner: LocalSimulationRunner,
  ticks: number,
  commandsForTick: (tick: number) => SimulationCommand[] = () => []
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks && !runner.getSnapshot().battleEnded; tick += 1) {
    events.push(...runner.step(commandsForTick(tick)));
  }
  return events;
}

function gunnerTraining(moduleIds: string[] = []): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8001,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'gunner', team: 1, controller: 'player', x: 180, y: 470, loadout: { moduleIds } },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 470, y: 470 }
    ],
    rules: {
      maxBattleTicks: 900,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: true,
        invulnerableTeams: [1, 2],
        suppressVictory: true
      }
    }
  };
  return new LocalSimulationRunner(battle);
}

const stopTarget = (): SimulationCommand => ({ type: 'stop', entityId: 1 });
const firePrimary = (direction = { x: 1, y: 0 }): SimulationCommand => ({
  type: 'activatePrimaryAttack',
  entityId: 0,
  targetId: 1,
  direction
});

function targetStatus(runner: LocalSimulationRunner, statusId: string) {
  return runner.getSnapshot().entities.find((entity) => entity.id === 1)?.statuses.find((status) => status.statusId === statusId);
}

describe('Stage 8.0 Gunner identity, combos and approved modules', () => {
  it('defines a developer-authored passive and a coherent four-skill combo kit', () => {
    const gunner = getFighter('gunner');
    expect(gunner.passiveIds).toEqual(['combat-analysis']);
    expect(getPassive('combat-analysis').triggers[0]?.event).toBe('ON_PRIMARY_HIT');
    expect(gunner.abilitySlots).toMatchObject({
      skill1: 'tactical-slide',
      skill2: 'suppressive-fire',
      skill3: 'pinning-round',
      ultimate: 'kill-zone'
    });
    expect(getAbility('pinning-round').triggers[0]?.conditions).toContainEqual({
      type: 'TARGET_HAS_STATUS',
      statusId: 'target-lock',
      minimumStacks: 2
    });
  });

  it('builds Target Lock from primary hits and caps it at four stacks', () => {
    const runner = gunnerTraining();
    const events = runTicks(runner, 42, (tick) => tick === 0 ? [firePrimary(), stopTarget()] : [stopTarget()]);
    expect(events.filter((event) => event.type === 'passiveTriggered' && event.passiveId === 'combat-analysis').length).toBeGreaterThanOrEqual(3);
    expect(targetStatus(runner, 'target-lock')?.stacks).toBe(4);
  });

  it('blocks Pinning Round without setup, then consumes Target Lock and applies its payoff', () => {
    const runner = gunnerTraining();
    const early = runner.step([{ type: 'activateAbility', entityId: 0, slot: 'skill3', targetId: 1, direction: { x: 1, y: 0 } }, stopTarget()]);
    expect(early.some((event) => event.type === 'abilityActivated' && event.abilityId === 'pinning-round')).toBe(false);

    runTicks(runner, 42, (tick) => tick === 0 ? [firePrimary(), stopTarget()] : [stopTarget()]);
    expect(targetStatus(runner, 'target-lock')?.stacks).toBe(4);

    const events = runTicks(runner, 70, (tick) => tick === 0
      ? [{ type: 'activateAbility', entityId: 0, slot: 'skill3', targetId: 1, direction: { x: 1, y: 0 } }, stopTarget()]
      : [stopTarget()]);
    expect(events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'pinning-round')).toBe(true);
    expect(events.some((event) => event.type === 'weaponHit' && event.weaponId === 'pinning-round-projectile')).toBe(true);
    expect(targetStatus(runner, 'target-lock')).toBeUndefined();
    expect(targetStatus(runner, 'pinned')).toBeDefined();
  });

  it('lets the generic AI build Target Lock and spend it on Gunner payoffs', () => {
    const battle: BattleDefinition = {
      seed: 8030,
      arenaId: 'iron-pit',
      modeId: 'duel',
      participants: [
        { fighterId: 'gunner', team: 1, controller: 'ai', x: 180, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 470, y: 470 }
      ],
      rules: {
        maxBattleTicks: 900,
        training: {
          enabled: true,
          damageEnabled: false,
          cooldownsEnabled: true,
          invulnerableTeams: [1, 2],
          suppressVictory: true
        }
      }
    };
    const runner = new LocalSimulationRunner(battle);
    const ai = new AiController(false);
    const events: SimulationEvent[] = [];
    for (let tick = 0; tick < 450; tick += 1) {
      const commands = [...ai.commandsForTick(runner.getRuntimeSnapshot()), stopTarget()];
      events.push(...runner.step(commands));
    }
    expect(events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'suppressive-fire')).toBe(true);
    expect(events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'pinning-round')).toBe(true);
    expect(events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'kill-zone')).toBe(true);
  });

  it('enforces fighter compatibility and one module per slot', () => {
    const gunner = getFighter('gunner');
    expect(listCompatibleModules(gunner, 'offense').map((module) => module.id)).toEqual(['ricochet-chamber', 'piercing-barrel', 'shoulder-missile-pod']);
    expect(() => resolveFighterLoadout(getFighter('pyro-brawler'), { moduleIds: ['ricochet-chamber'] })).toThrow(/cannot equip/i);
    expect(() => resolveFighterLoadout(gunner, { moduleIds: ['ricochet-chamber', 'piercing-barrel'] })).toThrow(/only one offense module/i);
  });

  it('makes Ricochet Chamber reflect primary bullets from arena walls', () => {
    const runner = gunnerTraining(['ricochet-chamber']);
    runTicks(runner, 13, (tick) => tick === 0
      ? [{ type: 'activatePrimaryAttack', entityId: 0, direction: { x: -1, y: 0 } }, stopTarget()]
      : [stopTarget()]);
    const reflected = runner.getSnapshot().projectiles.some((projectile) => projectile.weaponId === 'automatic-rifle' && projectile.vx > 0);
    expect(reflected).toBe(true);
  });

  it('lets Piercing Barrel continue through one enemy without hitting the same target twice', () => {
    const battle: BattleDefinition = {
      seed: 8002,
      arenaId: 'iron-pit',
      modeId: 'battle-royale',
      participants: [
        { fighterId: 'gunner', team: 1, controller: 'player', x: 130, y: 470, loadout: { moduleIds: ['piercing-barrel'] } },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 330, y: 470 },
        { fighterId: 'mech-bruiser', team: 3, controller: 'player', x: 510, y: 470 }
      ],
      rules: {
        maxBattleTicks: 900,
        training: { enabled: true, damageEnabled: false, cooldownsEnabled: true, invulnerableTeams: [1, 2, 3], suppressVictory: true }
      }
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runTicks(runner, 55, (tick) => tick === 0
      ? [{ type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } }, { type: 'stop', entityId: 1 }, { type: 'stop', entityId: 2 }]
      : [{ type: 'stop', entityId: 1 }, { type: 'stop', entityId: 2 }]);
    const hitTargets = new Set(events.flatMap((event) => event.type === 'weaponHit' && event.weaponId === 'automatic-rifle' ? [event.targetId] : []));
    expect(hitTargets.has(1)).toBe(true);
    expect(hitTargets.has(2)).toBe(true);
  });

  it('keeps the same seed and loadout deterministic while checksumming module choices', () => {
    const execute = (moduleIds: string[]) => {
      const runner = gunnerTraining(moduleIds);
      runTicks(runner, 90, (tick) => tick === 0 ? [firePrimary(), stopTarget()] : [stopTarget()]);
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(execute(['targeting-drone'])).toBe(execute(['targeting-drone']));
    expect(execute(['ricochet-chamber'])).not.toBe(execute(['piercing-barrel']));
  });
});
