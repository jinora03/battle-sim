import { describe, expect, it } from 'vitest';
import { abilitySchema, getFighter, getStatus, validateFighterReferences } from '@kinetic/content';
import type { BattleDefinition, EntitySnapshot, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function pyroTraining(): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8301,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 515, y: 470 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 660, y: 470 }
    ],
    rules: {
      maxBattleTicks: 1800,
      training: {
        enabled: true,
        damageEnabled: false,
        cooldownsEnabled: false,
        invulnerableTeams: [1, 2],
        suppressVictory: true
      }
    }
  };
  return new LocalSimulationRunner(battle);
}

function pyro(snapshot: ReturnType<LocalSimulationRunner['getSnapshot']>): EntitySnapshot {
  return snapshot.entities.find((entity) => entity.id === 0)!;
}

function heat(snapshot: ReturnType<LocalSimulationRunner['getSnapshot']>): number {
  return pyro(snapshot).resources?.find((resource) => resource.resourceId === 'heat')?.value ?? -1;
}

function runTicks(
  runner: LocalSimulationRunner,
  ticks: number,
  commandsForTick: (localTick: number) => SimulationCommand[] = () => []
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let localTick = 0; localTick < ticks; localTick += 1) {
    events.push(...runner.step(commandsForTick(localTick)));
  }
  return events;
}

const stopTarget = (): SimulationCommand => ({ type: 'stop', entityId: 1 });
const primary = (): SimulationCommand => ({
  type: 'activatePrimaryAttack',
  entityId: 0,
  targetId: 1,
  direction: { x: 1, y: 0 }
});

const ultimate = (): SimulationCommand => ({
  type: 'activateAbility',
  entityId: 0,
  slot: 'ultimate',
  targetId: 1,
  direction: { x: 1, y: 0 }
});

describe('Stage 8.3A Pyro Heat and Burn foundation', () => {
  it('defines reusable Heat content and stackable Burn without changing other fighters', () => {
    const pyroDefinition = getFighter('pyro-brawler');
    expect(pyroDefinition.combatResources).toEqual([{
      id: 'heat',
      name: 'Heat',
      maximum: 100,
      initial: 0,
      decayPerSecond: 6,
      decayDelayTicks: 120,
      gainRules: [
        { event: 'DAMAGE_DEALT', element: 'fire', amountPerDamage: 0.35, maximumPerEvent: 10 },
        { event: 'STATUS_APPLIED', statusId: 'burn', amountPerStack: 5 }
      ]
    }]);
    expect(getStatus('burn')).toMatchObject({ maxStacks: 5, refreshMode: 'refresh' });
    expect(getFighter('gunner').combatResources ?? []).toEqual([]);
  });

  it('rejects duplicate resource ids and initial values above the resource maximum', () => {
    const definition = getFighter('pyro-brawler');
    const heatDefinition = definition.combatResources![0]!;
    const errors = validateFighterReferences({
      ...definition,
      id: 'resource-validation-probe',
      combatResources: [
        heatDefinition,
        { ...heatDefinition },
        { ...heatDefinition, id: 'overheated', initial: heatDefinition.maximum + 1 }
      ]
    });
    expect(errors).toContain('Duplicate combat resource id: heat');
    expect(errors).toContain('Combat resource overheated initial value exceeds maximum');
  });

  it('publishes a zeroed Heat snapshot, then accounts for every Flame Jet hit and new Burn stack', () => {
    const runner = pyroTraining();
    const initial = pyro(runner.getSnapshot());
    expect(initial.resources).toEqual([{ resourceId: 'heat', value: 0, maximum: 100 }]);

    const events = runTicks(runner, 30, (tick) => tick === 0 ? [primary(), stopTarget()] : [stopTarget()]);
    const damageEvents = events.filter((event): event is Extract<SimulationEvent, { type: 'damage' }> => event.type === 'damage'
      && event.sourceId === 0
      && event.targetId === 1
      && event.element === 'fire');
    const furnaceTriggers = events.filter((event): event is Extract<SimulationEvent, { type: 'passiveTriggered' }> => event.type === 'passiveTriggered'
      && event.entityId === 0
      && event.passiveId === 'living-furnace');
    expect(damageEvents).toHaveLength(3);
    expect(furnaceTriggers).toHaveLength(3);

    const target = runner.getSnapshot().entities.find((entity) => entity.id === 1)!;
    const burnStacks = target.statuses.find((status) => status.statusId === 'burn')?.stacks ?? 0;
    expect(burnStacks).toBe(3);

    const expectedFromDamage = damageEvents.reduce((sum, event) => sum + Math.min(event.amount * 0.35, 10), 0);
    const expectedFromBurn = burnStacks * 5;
    const expectedFromLivingFurnace = furnaceTriggers.length * 2;
    expect(heat(runner.getSnapshot())).toBeCloseTo(
      expectedFromDamage + expectedFromBurn + expectedFromLivingFurnace,
      8
    );
  });

  it('caps Burn at five stacks and Heat at its configured maximum', () => {
    const runner = pyroTraining();
    runTicks(runner, 360, () => [primary(), stopTarget()]);
    const snapshot = runner.getSnapshot();
    const target = snapshot.entities.find((entity) => entity.id === 1)!;
    expect(target.statuses.find((status) => status.statusId === 'burn')?.stacks).toBe(5);
    expect(heat(snapshot)).toBe(100);
  });

  it('waits for the configured delay before deterministic Heat decay begins', () => {
    const runner = pyroTraining();
    const events = runTicks(runner, 80, (tick) => tick === 0 ? [ultimate(), stopTarget()] : [stopTarget()]);
    const fireDamage = events.find((event) => event.type === 'damage' && event.sourceId === 0 && event.element === 'fire');
    expect(fireDamage?.type).toBe('damage');
    const gainedAtTick = fireDamage?.tick ?? 0;
    const valueAfterGain = heat(runner.getSnapshot());
    expect(valueAfterGain).toBeGreaterThan(0);

    while (runner.tick < gainedAtTick + 119) runner.step([stopTarget()]);
    expect(heat(runner.getSnapshot())).toBeCloseTo(valueAfterGain, 8);
    runner.step([stopTarget()]);
    expect(heat(runner.getSnapshot())).toBeCloseTo(valueAfterGain - 0.1, 8);
  });

  it('does not leak a removed fighter resource into a non-resource reusable snapshot slot', () => {
    const battle: BattleDefinition = {
      seed: 83039,
      arenaId: 'pillar-court',
      modeId: 'team-battle',
      participants: [
        { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 400, y: 470, statScale: { hp: 0.01 } },
        { fighterId: 'gunner', team: 1, controller: 'player', x: 150, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 520, y: 470 },
        { fighterId: 'water-shaper', team: 2, controller: 'player', x: 700, y: 700 }
      ],
      rules: { maxBattleTicks: 900, teamCollision: 'ghost' }
    };
    const runner = new LocalSimulationRunner(battle);
    let pyroDied = false;
    for (let tick = 0; tick < 120 && !pyroDied; tick += 1) {
      const events = runner.step([
        { type: 'activatePrimaryAttack', entityId: 2, targetId: 0, direction: { x: -1, y: 0 } },
        { type: 'stop', entityId: 0 },
        { type: 'stop', entityId: 1 }
      ]);
      pyroDied = events.some((event) => event.type === 'death' && event.entityId === 0);
    }
    expect(pyroDied).toBe(true);
    expect(runner.getSnapshot().entities.find((entity) => entity.id === 1)?.resources).toBeUndefined();
  });

  it('accepts generic resource gates and resource modifications in ability data', () => {
    const parsed = abilitySchema.parse({
      id: 'resource-foundation-test',
      name: 'Resource Foundation Test',
      slot: 'skill1',
      cooldownTicks: 1,
      castTicks: 0,
      castMovementMultiplier: 1,
      triggers: [{
        event: 'ON_ACTIVATE',
        conditions: [{ type: 'SELF_RESOURCE_AT_LEAST', resourceId: 'heat', amount: 25 }],
        actions: [{ type: 'MODIFY_RESOURCE_SELF', resourceId: 'heat', amount: -25 }]
      }]
    });
    expect(parsed.triggers[0]?.conditions[0]).toMatchObject({ type: 'SELF_RESOURCE_AT_LEAST', resourceId: 'heat', amount: 25 });
    expect(parsed.triggers[0]?.actions[0]).toMatchObject({ type: 'MODIFY_RESOURCE_SELF', resourceId: 'heat', amount: -25 });
  });

  it('keeps Heat, Burn and the final checksum deterministic for the same command stream', () => {
    const execute = () => {
      const runner = pyroTraining();
      runTicks(runner, 240, (tick) => tick % 45 === 0 ? [primary(), stopTarget()] : [stopTarget()]);
      const snapshot = runner.getSnapshot();
      return {
        checksum: checksumSnapshot(snapshot),
        heat: heat(snapshot),
        burn: snapshot.entities.find((entity) => entity.id === 1)?.statuses.find((status) => status.statusId === 'burn')?.stacks ?? 0
      };
    };
    expect(execute()).toEqual(execute());
  });
});
