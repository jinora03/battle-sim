import { describe, expect, it } from 'vitest';
import {
  getAbility,
  getAiProfile,
  getFighter,
  getPassive,
  getPrimaryAttack,
  listCompatibleModules,
  resolveFighterLoadout
} from '@kinetic/content';
import { selectAbilityAction } from '@kinetic/controllers';
import type {
  BattleDefinition,
  EntitySnapshot,
  SimulationCommand,
  SimulationEvent,
  WorldSnapshot
} from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import { getSkillPresentation } from '@kinetic/visual-engine';

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

function pyroTraining(moduleIds: string[] = [], targetX = 620): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8311,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 400, y: 470, loadout: { moduleIds } },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: targetX, y: 470 }
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

const stop = (entityId: number): SimulationCommand => ({ type: 'stop', entityId });
const primary = (): SimulationCommand => ({
  type: 'activatePrimaryAttack',
  entityId: 0,
  targetId: 1,
  direction: { x: 1, y: 0 }
});
const ability = (slot: 'skill1' | 'skill2' | 'skill3' | 'ultimate', targetId: number | undefined = 1): SimulationCommand => ({
  type: 'activateAbility',
  entityId: 0,
  slot,
  ...(targetId !== undefined ? { targetId } : {}),
  direction: { x: 1, y: 0 }
});

function entity(snapshot: WorldSnapshot, id: number): EntitySnapshot {
  return snapshot.entities.find((candidate) => candidate.id === id)!;
}

function burnStacks(snapshot: WorldSnapshot, id = 1): number {
  return entity(snapshot, id).statuses.find((status) => status.statusId === 'burn')?.stacks ?? 0;
}

function heat(snapshot: WorldSnapshot): number {
  return entity(snapshot, 0).resources?.find((resource) => resource.resourceId === 'heat')?.value ?? 0;
}

function prepareCombustion(moduleIds: string[]): {
  runner: LocalSimulationRunner;
  setupStacks: number;
  events: SimulationEvent[];
} {
  const runner = pyroTraining(moduleIds);
  runTicks(runner, 45, (tick) => tick === 0 ? [primary(), stop(1)] : [stop(1)]);
  const setupStacks = burnStacks(runner.getSnapshot());
  const events = runTicks(runner, 36, (tick) => tick === 0 ? [ability('skill3'), stop(1)] : [stop(1)]);
  return { runner, setupStacks, events };
}

describe('Stage 8.3B full Pyro rework', () => {
  it('ships the complete Living Furnace combo kit while preserving stable content ids', () => {
    const pyro = getFighter('pyro-brawler');
    expect(pyro.passiveIds).toEqual(['living-furnace']);
    expect(getPassive('living-furnace').name).toBe('Living Furnace');
    expect(getPrimaryAttack(pyro.primaryAttackId)).toMatchObject({
      id: 'flame-fists',
      name: 'Flame Jet',
      behavior: 'automatic',
      burstCount: 3
    });
    expect(getAbility(pyro.abilitySlots.skill1!)).toMatchObject({ id: 'magma-dash', name: 'Cinder Rush' });
    expect(getAbility(pyro.abilitySlots.skill2!)).toMatchObject({ id: 'flame-ring', name: 'Fire Vortex' });
    expect(getAbility(pyro.abilitySlots.skill3!)).toMatchObject({ id: 'molten-guard', name: 'Combustion' });
    expect(getAbility(pyro.abilitySlots.ultimate!)).toMatchObject({ id: 'inferno-collapse', name: 'Meltdown' });

    expect(getSkillPresentation('magma-dash')).toMatchObject({ shortName: 'Cinder Rush', resolve: 'cinder-rush' });
    expect(getSkillPresentation('flame-ring')).toMatchObject({ shortName: 'Fire Vortex', resolve: 'fire-vortex' });
    expect(getSkillPresentation('molten-guard')).toMatchObject({ shortName: 'Combustion', resolve: 'combustion' });
    expect(getSkillPresentation('inferno-collapse')).toMatchObject({ shortName: 'Meltdown', resolve: 'meltdown' });
  });

  it('turns Flame Jet into a three-pulse fire stream that visibly primes Burn and Heat', () => {
    const runner = pyroTraining();
    const events = runTicks(runner, 45, (tick) => tick === 0 ? [primary(), stop(1)] : [stop(1)]);
    const spawns = events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'flame-fists');
    const hits = events.filter((event) => event.type === 'weaponHit' && event.weaponId === 'flame-fists');
    expect(spawns).toHaveLength(3);
    expect(hits).toHaveLength(3);
    expect(burnStacks(runner.getSnapshot())).toBe(3);
    expect(heat(runner.getSnapshot())).toBeGreaterThan(20);
    expect(events.filter((event) => event.type === 'passiveTriggered' && event.passiveId === 'living-furnace')).toHaveLength(3);
  });

  it('makes Cinder Rush a real directional engage with an ignition window', () => {
    const baseline = pyroTraining([], 850);
    const afterburner = pyroTraining(['afterburner'], 850);
    const execute = (runner: LocalSimulationRunner) => {
      const startX = entity(runner.getSnapshot(), 0).x;
      const events = runTicks(runner, 24, (tick) => tick === 0 ? [ability('skill1', undefined), stop(1)] : [stop(1)]);
      return {
        distance: entity(runner.getSnapshot(), 0).x - startX,
        events,
        status: entity(runner.getSnapshot(), 0).statuses.find((status) => status.statusId === 'magma-dash')
      };
    };
    const normal = execute(baseline);
    const enhanced = execute(afterburner);
    expect(normal.events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'magma-dash')).toBe(true);
    expect(normal.distance).toBeGreaterThan(20);
    expect(normal.status).toBeDefined();
    expect(enhanced.distance).toBeGreaterThan(normal.distance);
    expect((enhanced.status?.remainingTicks ?? 0)).toBeGreaterThan(normal.status?.remainingTicks ?? 0);
  });

  it('centers Fire Vortex on the selected target, pulls nearby enemies inward and ignites them', () => {
    const battle: BattleDefinition = {
      seed: 8312,
      arenaId: 'iron-pit',
      modeId: 'battle-royale',
      participants: [
        { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 350, y: 470 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 600, y: 470 },
        { fighterId: 'water-shaper', team: 3, controller: 'player', x: 710, y: 470 }
      ],
      rules: {
        maxBattleTicks: 900,
        training: { enabled: true, damageEnabled: false, cooldownsEnabled: false, invulnerableTeams: [1, 2, 3], suppressVictory: true }
      }
    };
    const runner = new LocalSimulationRunner(battle);
    const initialX = entity(runner.getSnapshot(), 2).x;
    const events = runTicks(runner, 20, (tick) => tick === 0
      ? [ability('skill2'), stop(1), stop(2)]
      : [stop(1), stop(2)]);
    const targetXAtResolution = entity(runner.getSnapshot(), 1).x;
    events.push(...runner.step([stop(1), stop(2)]));
    events.push(...runTicks(runner, 9, () => [stop(1), stop(2)]));
    const vortex = events.find((event) => event.type === 'blast' && event.abilityId === 'flame-ring');
    expect(vortex?.type).toBe('blast');
    if (vortex?.type === 'blast') expect(vortex.position.x).toBeCloseTo(targetXAtResolution, 4);
    expect(burnStacks(runner.getSnapshot(), 1)).toBeGreaterThanOrEqual(1);
    expect(burnStacks(runner.getSnapshot(), 2)).toBeGreaterThanOrEqual(1);
    expect(entity(runner.getSnapshot(), 2).x).toBeLessThan(initialX);
  });

  it('rejects Combustion without setup, then consumes Burn with stack-scaled damage and force', () => {
    const unprimed = pyroTraining();
    const rejected = unprimed.step([ability('skill3'), stop(1)]);
    expect(rejected.some((event) => event.type === 'abilityActivated' && event.abilityId === 'molten-guard')).toBe(false);

    const baseline = prepareCombustion([]);
    const accelerated = prepareCombustion(['accelerant-nozzle']);
    expect(baseline.setupStacks).toBe(3);
    expect(accelerated.setupStacks).toBe(5);

    const normalBlast = baseline.events.find((event) => event.type === 'blast' && event.abilityId === 'molten-guard');
    const enhancedBlast = accelerated.events.find((event) => event.type === 'blast' && event.abilityId === 'molten-guard');
    expect(normalBlast?.type).toBe('blast');
    expect(enhancedBlast?.type).toBe('blast');
    if (normalBlast?.type === 'blast' && enhancedBlast?.type === 'blast') {
      expect(enhancedBlast.damage).toBeGreaterThan(normalBlast.damage);
      expect(enhancedBlast.force).toBeGreaterThan(normalBlast.force);
      expect(enhancedBlast.radius).toBeGreaterThan(normalBlast.radius);
    }
    expect(burnStacks(baseline.runner.getSnapshot())).toBe(0);
    expect(burnStacks(accelerated.runner.getSnapshot())).toBe(0);
  });

  it('enters Meltdown at maximum Heat and empowers Flame Jet during the transformation', () => {
    const runner = pyroTraining();
    const ultimateEvents = runTicks(runner, 58, (tick) => tick === 0 ? [ability('ultimate'), stop(1)] : [stop(1)]);
    const snapshot = runner.getSnapshot();
    expect(ultimateEvents.some((event) => event.type === 'abilityResolved' && event.abilityId === 'inferno-collapse')).toBe(true);
    expect(ultimateEvents.some((event) => event.type === 'blast' && event.abilityId === 'inferno-collapse')).toBe(true);
    expect(heat(snapshot)).toBe(100);
    expect(entity(snapshot, 0).statuses.some((status) => status.statusId === 'meltdown')).toBe(true);
    expect(burnStacks(snapshot)).toBe(2);

    const empowered = runTicks(runner, 40, (tick) => tick === 0 ? [primary(), stop(1)] : [stop(1)]);
    expect(empowered.some((event) => event.type === 'passiveTriggered' && event.passiveId === 'living-furnace')).toBe(true);
    const fireDamageEvents = empowered.filter((event) => event.type === 'damage' && event.sourceId === 0 && event.targetId === 1 && event.element === 'fire');
    expect(fireDamageEvents.length).toBeGreaterThan(3);
    expect(burnStacks(runner.getSnapshot())).toBe(5);
  });

  it('registers seven developer-approved Pyro modules and resolves their real gameplay modifiers', () => {
    const pyro = getFighter('pyro-brawler');
    expect(listCompatibleModules(pyro).map((module) => module.id)).toEqual([
      'accelerant-nozzle',
      'blast-vent',
      'furnace-nozzle',
      'thermal-shield',
      'afterburner',
      'ember-satellite',
      'overpressure-core'
    ]);

    const resolved = resolveFighterLoadout(pyro, {
      moduleIds: ['blast-vent', 'thermal-shield', 'afterburner', 'ember-satellite']
    });
    expect(resolved.abilityDamageMultiplier['molten-guard']).toBe(1.18);
    expect(resolved.abilityImpulseMultiplier['molten-guard']).toBe(1.24);
    expect(resolved.abilitySelfImpulseMultiplier['magma-dash']).toBe(1.28);
    expect(resolved.periodicStatusPulses).toEqual([
      {
        statusId: 'burn',
        radius: 210,
        intervalTicks: 120,
        durationTicks: 140,
        stacks: 1,
        resourceId: 'heat',
        minimumResource: 20
      }
    ]);
    expect(resolved.resourceThresholdIncomingDamageMultiplier).toEqual({
      resourceId: 'heat', thresholdRatio: 0.6, multiplier: 0.84
    });
    expect(resolved.mountedAttachments.some((attachment) => attachment.kind === 'ember-satellite')).toBe(true);
  });

  it('makes Ember Satellite periodically spread visible Burn while Pyro has active Heat', () => {
    const battle: BattleDefinition = {
      seed: 8314,
      arenaId: 'iron-pit',
      modeId: 'battle-royale',
      participants: [
        { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 400, y: 470, loadout: { moduleIds: ['ember-satellite'] } },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 570, y: 470 },
        { fighterId: 'water-shaper', team: 3, controller: 'player', x: 400, y: 640 }
      ],
      rules: {
        maxBattleTicks: 900,
        training: { enabled: true, damageEnabled: false, cooldownsEnabled: false, invulnerableTeams: [1, 2, 3], suppressVictory: true }
      }
    };
    const runner = new LocalSimulationRunner(battle);
    const events = runTicks(runner, 125, (tick) => tick === 0
      ? [primary(), stop(1), stop(2)]
      : [stop(1), stop(2)]);
    expect(heat(runner.getSnapshot())).toBeGreaterThanOrEqual(20);
    expect(events.some((event) =>
      event.type === 'statusApplied'
      && event.tick === 120
      && event.sourceId === 0
      && event.targetId === 2
      && event.statusId === 'burn')).toBe(true);
    expect(burnStacks(runner.getSnapshot(), 2)).toBeGreaterThanOrEqual(1);
  });

  it('applies Blast Vent, Thermal Shield and Overpressure Core in the simulation', () => {
    const combustion = (moduleIds: string[]) => prepareCombustion(moduleIds).events
      .find((event) => event.type === 'blast' && event.abilityId === 'molten-guard');
    const normalCombustion = combustion([]);
    const ventedCombustion = combustion(['blast-vent']);
    expect(normalCombustion?.type).toBe('blast');
    expect(ventedCombustion?.type).toBe('blast');
    if (normalCombustion?.type === 'blast' && ventedCombustion?.type === 'blast') {
      expect(ventedCombustion.damage).toBeCloseTo(normalCombustion.damage * 1.18, 8);
      expect(ventedCombustion.radius).toBeCloseTo(normalCombustion.radius * 1.12, 8);
      expect(ventedCombustion.force).toBeGreaterThan(normalCombustion.force);
    }

    const meltdownBlast = (moduleIds: string[]) => {
      const runner = pyroTraining(moduleIds);
      return runTicks(runner, 58, (tick) => tick === 0 ? [ability('ultimate'), stop(1)] : [stop(1)])
        .find((event) => event.type === 'blast' && event.abilityId === 'inferno-collapse');
    };
    const normalMeltdown = meltdownBlast([]);
    const overpressure = meltdownBlast(['overpressure-core']);
    expect(normalMeltdown?.type).toBe('blast');
    expect(overpressure?.type).toBe('blast');
    if (normalMeltdown?.type === 'blast' && overpressure?.type === 'blast') {
      expect(overpressure.damage).toBeCloseTo(normalMeltdown.damage * 1.2, 8);
      expect(overpressure.radius).toBeCloseTo(normalMeltdown.radius * 1.15, 8);
    }

    const incomingDamage = (moduleIds: string[]) => {
      const battle: BattleDefinition = {
        seed: 8313,
        arenaId: 'iron-pit',
        modeId: 'duel',
        participants: [
          { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 400, y: 470, loadout: { moduleIds } },
          { fighterId: 'gunner', team: 2, controller: 'player', x: 650, y: 470 }
        ],
        rules: {
          maxBattleTicks: 900,
          training: { enabled: true, damageEnabled: false, cooldownsEnabled: false, invulnerableTeams: [1, 2], suppressVictory: true }
        }
      };
      const runner = new LocalSimulationRunner(battle);
      runTicks(runner, 58, (tick) => tick === 0 ? [ability('ultimate'), stop(1)] : [stop(0), stop(1)]);
      const events = runTicks(runner, 45, (tick) => tick === 0
        ? [{ type: 'activatePrimaryAttack', entityId: 1, targetId: 0, direction: { x: -1, y: 0 } }, stop(0)]
        : [stop(0)]);
      return events.find((event) => event.type === 'damage' && event.sourceId === 1 && event.targetId === 0);
    };
    const normalHit = incomingDamage([]);
    const shieldedHit = incomingDamage(['thermal-shield']);
    expect(normalHit?.type).toBe('damage');
    expect(shieldedHit?.type).toBe('damage');
    if (normalHit?.type === 'damage' && shieldedHit?.type === 'damage') {
      expect(shieldedHit.amount).toBeCloseTo(normalHit.amount * 0.84, 8);
    }
  });

  it('makes the generic AI wait for Burn and Heat, then select Combustion as the payoff', () => {
    const runner = pyroTraining();
    const snapshot = runner.getSnapshot();
    const self = entity(snapshot, 0);
    const target = entity(snapshot, 1);
    const profile = getAiProfile('pyro-combo-bruiser');

    const unprimed = selectAbilityAction(snapshot, self, target, profile);
    expect(unprimed.debug.candidates.find((candidate) => candidate.slot === 'skill3')).toMatchObject({
      valid: false,
      reason: 'needs 2 burn stacks'
    });

    const primedSelf: EntitySnapshot = {
      ...self,
      resources: [{ resourceId: 'heat', value: 70, maximum: 100 }],
      abilities: self.abilities.map((state) => ({ ...state }))
    };
    const primedTarget: EntitySnapshot = {
      ...target,
      statuses: [...target.statuses, { statusId: 'burn', remainingTicks: 120, stacks: 4 }]
    };
    const primedSnapshot: WorldSnapshot = {
      ...snapshot,
      entities: [primedSelf, primedTarget]
    };
    const primed = selectAbilityAction(primedSnapshot, primedSelf, primedTarget, profile);
    expect(primed.selected).toMatchObject({ kind: 'ability', slot: 'skill3', abilityId: 'molten-guard' });
  });

  it('keeps the complete Pyro combo and module state deterministic', () => {
    const execute = () => {
      const runner = pyroTraining(['blast-vent', 'afterburner', 'ember-satellite']);
      const events: SimulationEvent[] = [];
      events.push(...runTicks(runner, 45, (tick) => tick === 0 ? [primary(), stop(1)] : [stop(1)]));
      events.push(...runTicks(runner, 36, (tick) => tick === 0 ? [ability('skill3'), stop(1)] : [stop(1)]));
      events.push(...runTicks(runner, 58, (tick) => tick === 0 ? [ability('ultimate'), stop(1)] : [stop(1)]));
      return {
        checksum: checksumSnapshot(runner.getSnapshot()),
        events,
        snapshot: runner.getSnapshot()
      };
    };
    expect(execute()).toEqual(execute());
  });
});
