import { describe, expect, it } from 'vitest';
import { getAbility, getFighter, listFighters } from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

function trainingDuel(fighterId: string): LocalSimulationRunner {
  const opponentId = fighterId === 'mech-bruiser' ? 'pyro-brawler' : 'mech-bruiser';
  const battle: BattleDefinition = {
    seed: 8280,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId, team: 1, controller: 'player', x: 220, y: 470 },
      { fighterId: opponentId, team: 2, controller: 'player', x: 440, y: 470 }
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

function runUltimate(runner: LocalSimulationRunner, ticks: number, includeTarget = true): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const commands: SimulationCommand[] = tick === 0
      ? [
          { type: 'activateAbility', entityId: 0, slot: 'ultimate', ...(includeTarget ? { targetId: 1 } : {}), direction: { x: 1, y: 0 } },
          { type: 'stop', entityId: 1 }
        ]
      : [{ type: 'stop', entityId: 1 }];
    events.push(...runner.step(commands));
  }
  return events;
}

describe('Stage 8.2.8 ultimate activation stability', () => {
  it('lets Gunner fire Kill Zone without a hidden Target Lock prerequisite', () => {
    const runner = trainingDuel('gunner');
    const targetBefore = runner.getSnapshot().entities.find((entity) => entity.id === 1)!;
    expect(targetBefore.statuses.some((status) => status.statusId === 'target-lock')).toBe(false);

    const events = runUltimate(runner, 90, false);
    expect(events.some((event) => event.type === 'abilityActivated' && event.abilityId === 'kill-zone')).toBe(true);
    expect(events.some((event) => event.type === 'abilityResolved' && event.abilityId === 'kill-zone')).toBe(true);
    expect(events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'kill-zone-missile')).toHaveLength(10);
  });

  it('keeps every built-in fighter ultimate activatable and resolvable', () => {
    const builtins = listFighters().filter((fighter) => !fighter.classification.traits.includes('custom'));
    expect(builtins.length).toBeGreaterThan(0);

    for (const fighter of builtins) {
      const ultimateId = getFighter(fighter.id).abilitySlots.ultimate;
      expect(ultimateId, `${fighter.id} should define an ultimate`).toBeTruthy();
      const ability = getAbility(ultimateId!);
      const events = runUltimate(trainingDuel(fighter.id), ability.castTicks + 40);
      expect(
        events.some((event) => event.type === 'abilityActivated' && event.abilityId === ultimateId),
        `${fighter.id}:${ultimateId} should activate`
      ).toBe(true);
      expect(
        events.some((event) => event.type === 'abilityResolved' && event.abilityId === ultimateId),
        `${fighter.id}:${ultimateId} should resolve`
      ).toBe(true);
    }
  });
});
