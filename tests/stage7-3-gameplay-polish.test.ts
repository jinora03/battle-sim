import { describe, expect, it } from 'vitest';
import {
  getAiProfile,
  getFighter,
  getPrimaryAttack,
  getProjectileSource
} from '@kinetic/content';
import { selectAbilityAction } from '@kinetic/controllers';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { evaluatePlayerAim, resolvePlayerTargetingPreview } from '../packages/renderer-pixi/src/playerTargeting';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';

function trainingBattle(participants: BattleDefinition['participants'], seed = 7301): LocalSimulationRunner {
  return new LocalSimulationRunner({
    seed,
    arenaId: 'training-grid',
    modeId: 'training',
    participants,
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 1_500,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  });
}

function run(runner: LocalSimulationRunner, ticks: number, first?: SimulationCommand): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runner.step(tick === 0 && first ? [first] : []));
  return events;
}

describe('v1.1 Stage 7.3 combat polish and missile artillery', () => {
  it('registers Rocket Vanguard and the tuned primary attacks', () => {
    expect(getFighter('rocket-vanguard').primaryAttackId).toBe('guided-rocket');
    expect(getProjectileSource('micro-missile').projectile?.homingStrength).toBeGreaterThan(0);
    expect(getPrimaryAttack('automatic-rifle').damage).toBeLessThanOrEqual(4);
    expect(getPrimaryAttack('demolition-bomb').projectile?.speed).toBe(14.2);
    expect(getPrimaryAttack('lancer-spear').range).toBeGreaterThan(getPrimaryAttack('thorn-claws').range);
  });

  it('shows a distinct valid range for every player skill slot', () => {
    const runner = trainingBattle([
      { fighterId: 'rocket-vanguard', team: 1, controller: 'player', x: 200, y: 360 },
      { fighterId: 'bomber', team: 2, controller: 'ai', x: 650, y: 360 }
    ]);
    const snapshot = runner.getSnapshot();
    const player = snapshot.entities.find((entity) => entity.controller === 'player')!;
    for (const slot of ['basic', 'skill1', 'skill2', 'skill3', 'ultimate'] as const) {
      const preview = resolvePlayerTargetingPreview(player, slot);
      expect(preview.label.length).toBeGreaterThan(0);
      expect(preview.maxRange).toBeGreaterThanOrEqual(preview.minRange);
    }
    const basic = resolvePlayerTargetingPreview(player, 'basic');
    expect(evaluatePlayerAim(snapshot, player, { x: player.x + basic.maxRange + 40, y: player.y }, basic).reason).toBe('out-of-range');
    expect(evaluatePlayerAim(snapshot, player, { x: player.x + basic.maxRange * 0.75, y: player.y }, basic).valid).toBe(true);
  });

  it('rejects out-of-range AI skills before issuing a command', () => {
    const runner = trainingBattle([
      { fighterId: 'rocket-vanguard', team: 1, controller: 'ai', x: 70, y: 360 },
      { fighterId: 'bomber', team: 2, controller: 'ai', x: 970, y: 360 }
    ]);
    const snapshot = runner.getSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const selection = selectAbilityAction(snapshot, self, target, getAiProfile('rocket-artillery'));
    const rangedSkills = selection.debug.candidates.filter((candidate) => ['skill1', 'skill3', 'ultimate'].includes(candidate.slot));
    expect(rangedSkills.some((candidate) => candidate.valid)).toBe(false);
    expect(['skill1', 'skill3', 'ultimate']).not.toContain(selection.selected?.slot);
  });

  it('launches sixteen deterministic radial micro-missiles that converge after scattering', () => {
    const execute = () => {
      const runner = trainingBattle([
        { fighterId: 'rocket-vanguard', team: 1, controller: 'player', x: 360, y: 360 },
        { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 680, y: 360 }
      ], 7304);
      const start = runner.getSnapshot();
      const self = start.entities.find((entity) => entity.team === 1)!;
      const target = start.entities.find((entity) => entity.team === 2)!;
      const events = run(runner, 110, {
        type: 'activateAbility', entityId: self.id, slot: 'ultimate', targetId: target.id, direction: { x: 1, y: 0 }
      });
      return {
        spawned: events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'micro-missile').length,
        targetIds: events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'micro-missile').map((event) => event.type === 'projectileSpawned' ? event.targetId : undefined),
        checksum: checksumSnapshot(runner.getSnapshot())
      };
    };
    const first = execute();
    const second = execute();
    expect(first.spawned).toBe(16);
    expect(first.targetIds.every((id) => id !== undefined)).toBe(true);
    expect(second.checksum).toBe(first.checksum);
  });

  it('applies real explosion knockback that can drive targets into walls', () => {
    const runner = trainingBattle([
      { fighterId: 'bomber', team: 1, controller: 'player', x: 850, y: 360 },
      { fighterId: 'water-shaper', team: 2, controller: 'player', x: 900, y: 360 }
    ], 7305);
    const snapshot = runner.getSnapshot();
    const bomber = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const events = run(runner, 100, {
      type: 'activateAbility', entityId: bomber.id, slot: 'ultimate', targetId: target.id, direction: { x: 1, y: 0 }
    });
    expect(events.some((event) => event.type === 'blast' && event.force > 0)).toBe(true);
    expect(events.some((event) => event.type === 'wallImpact' && event.entityId === target.id)).toBe(true);
  });
});
