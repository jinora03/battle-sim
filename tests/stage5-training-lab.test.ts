import { describe, expect, it } from 'vitest';
import type { AbilitySlot, BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function trainingBattle(overrides: Partial<BattleDefinition> = {}): BattleDefinition {
  return {
    seed: 515151,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'volt-striker', team: 1, controller: 'player', x: 245, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'replay', x: 745, y: 360, statScale: { hp: 2.5 } }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      training: {
        enabled: true,
        damageEnabled: true,
        cooldownsEnabled: true,
        invulnerableTeams: [2],
        suppressVictory: true
      }
    },
    ...overrides
  };
}

function fireUntilDamage(runner: LocalSimulationRunner, slot: AbilitySlot = 'basic', maxTicks = 120): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let index = 0; index < maxTicks; index += 1) {
    const snapshot = runner.getSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1);
    const target = snapshot.entities.find((entity) => entity.team === 2);
    const commands: SimulationCommand[] = [];
    if (index === 0 && self && target) {
      commands.push(slot === 'basic'
        ? { type: 'activatePrimaryAttack', entityId: self.id, targetId: target.id, direction: { x: 1, y: 0 } }
        : { type: 'activateAbility', entityId: self.id, slot, targetId: target.id, direction: { x: 1, y: 0 } });
    }
    events.push(...runner.step(commands));
    if (events.some((event) => event.type === 'damage')) break;
  }
  return events;
}

describe('v1.1 Stage 5 Ability Lab', () => {
  it('reports real damage without reducing HP when target invulnerability is enabled', () => {
    const runner = new LocalSimulationRunner(trainingBattle());
    const initialTarget = runner.getSnapshot().entities.find((entity) => entity.team === 2)!;
    const events = fireUntilDamage(runner);
    const damage = events.find((event) => event.type === 'damage');
    const target = runner.getSnapshot().entities.find((entity) => entity.team === 2)!;

    expect(damage?.type).toBe('damage');
    if (damage?.type === 'damage') {
      expect(damage.prevented).toBe(true);
      expect(damage.amount).toBeGreaterThan(0);
      expect(damage.position).toBeDefined();
    }
    expect(target.hp).toBe(initialTarget.hp);
    expect(target.statuses.some((status) => status.statusId === 'shocked')).toBe(true);
  });

  it('supports a damage-off toggle independently from target invulnerability', () => {
    const runner = new LocalSimulationRunner(trainingBattle());
    runner.setTrainingRules({ damageEnabled: false, invulnerableTeams: [] });
    const before = runner.getSnapshot().entities.find((entity) => entity.team === 2)!.hp;
    const events = fireUntilDamage(runner);
    const damage = events.find((event) => event.type === 'damage');
    const after = runner.getSnapshot().entities.find((entity) => entity.team === 2)!.hp;

    expect(damage?.type === 'damage' && damage.prevented).toBe(true);
    expect(after).toBe(before);
  });

  it('clears cooldown state and permits rapid repeated attacks when cooldowns are disabled', () => {
    const runner = new LocalSimulationRunner(trainingBattle());
    runner.setTrainingRules({ cooldownsEnabled: false });
    let activations = 0;

    for (let tick = 0; tick < 30; tick += 1) {
      const snapshot = runner.getSnapshot();
      const self = snapshot.entities.find((entity) => entity.team === 1)!;
      const target = snapshot.entities.find((entity) => entity.team === 2)!;
      const events = runner.step([{ type: 'activatePrimaryAttack', entityId: self.id, targetId: target.id, direction: { x: 1, y: 0 } }]);
      activations += events.filter((event) => event.type === 'weaponAttackStarted').length;
    }

    const basic = runner.getSnapshot().entities.find((entity) => entity.team === 1)!.abilities.find((ability) => ability.slot === 'basic')!;
    expect(activations).toBeGreaterThanOrEqual(2);
    expect(basic.cooldownRemainingTicks).toBe(0);
  });

  it('suppresses victory while still allowing a non-invulnerable dummy to be defeated', () => {
    const battle = trainingBattle({
      participants: [
        { fighterId: 'pyro-brawler', team: 1, controller: 'player', x: 245, y: 360 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'replay', x: 330, y: 360, statScale: { hp: 0.02 } }
      ],
      rules: {
        friendlyFire: false,
        teamCollision: 'ghost',
        training: { enabled: true, damageEnabled: true, cooldownsEnabled: false, invulnerableTeams: [], suppressVictory: true }
      }
    });
    const runner = new LocalSimulationRunner(battle);
    fireUntilDamage(runner, 'basic', 80);
    for (let index = 0; index < 10; index += 1) runner.step([]);
    const snapshot = runner.getSnapshot();

    expect(snapshot.entities.some((entity) => entity.team === 2)).toBe(false);
    expect(snapshot.battleEnded).toBe(false);
    expect(snapshot.result).toBeNull();
  });

  it('repeats the same training projectile scenario deterministically', () => {
    const run = () => {
      const runner = new LocalSimulationRunner(trainingBattle());
      runner.setTrainingRules({ invulnerableTeams: [2], suppressVictory: true });
      fireUntilDamage(runner);
      for (let index = 0; index < 25; index += 1) runner.step([]);
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(run()).toBe(run());
  });
});
