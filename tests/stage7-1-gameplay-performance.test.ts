import { describe, expect, it } from 'vitest';
import {
  getAiProfile,
  getFighter,
  getPrimaryAttack,
  getPrimaryAttackActivationProfile
} from '@kinetic/content';
import { AiController, PlayerController, selectAbilityAction } from '@kinetic/controllers';
import type { BattleDefinition, EntitySnapshot, WorldSnapshot } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';
import { getMotionRecipe, getVisualRecipe, resolveVfxQuality } from '@kinetic/visual-engine';

function duel(participants: BattleDefinition['participants'], seed = 771): LocalSimulationRunner {
  return new LocalSimulationRunner({
    seed,
    arenaId: 'training-grid',
    modeId: 'training',
    participants,
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 1_200,
      training: { enabled: true, damageEnabled: true, cooldownsEnabled: true, suppressVictory: true }
    }
  });
}

function withOnlyBasicReady(entity: EntitySnapshot): EntitySnapshot {
  return {
    ...entity,
    abilities: entity.abilities.map((ability) => ability.slot === 'basic'
      ? { ...ability, phase: 'ready' as const, cooldownRemainingTicks: 0 }
      : { ...ability, phase: 'cooldown' as const, cooldownRemainingTicks: 600 })
  };
}

describe('v1.1 Stage 7.2 gameplay and performance pass', () => {
  it('registers Gunner with one authoritative automatic-rifle primary attack', () => {
    const fighter = getFighter('gunner');
    const primary = getPrimaryAttack(fighter.primaryAttackId);
    const activation = getPrimaryAttackActivationProfile(primary);

    expect(fighter.primaryAttackId).toBe('automatic-rifle');
    expect(fighter.abilitySlots.basic).toBeUndefined();
    expect(primary.behavior).toBe('automatic');
    expect(primary.burstCount).toBe(4);
    expect(activation.minRange).toBe(primary.minRange);
    expect(activation.maxRange).toBe(primary.range);
    expect('weapon' in getVisualRecipe('gunner')).toBe(false);
    expect(getMotionRecipe('gunner-mobile').id).toBe('gunner-mobile');
  });

  it('fires a deterministic four-shot automatic-rifle burst through real projectile entities', () => {
    const runner = duel([
      { fighterId: 'gunner', team: 1, controller: 'player', x: 260, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 650, y: 360 }
    ]);
    const self = runner.getSnapshot().entities.find((entity) => entity.team === 1)!;
    const target = runner.getSnapshot().entities.find((entity) => entity.team === 2)!;
    let spawned = 0;

    for (let tick = 0; tick < 24; tick += 1) {
      const events = runner.step(tick === 0 ? [{
        type: 'activatePrimaryAttack',
        entityId: self.id,
        targetId: target.id,
        direction: { x: 1, y: 0 }
      }] : []);
      spawned += events.filter((event) => event.type === 'projectileSpawned' && event.weaponId === 'automatic-rifle').length;
    }

    expect(spawned).toBe(4);
  });

  it('uses a valid primary attack as fallback while giving ready skills priority', () => {
    const runner = duel([
      { fighterId: 'gunner', team: 1, x: 260, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, x: 620, y: 360 }
    ]);
    const snapshot = runner.getSnapshot();
    const original = snapshot.entities.find((entity) => entity.team === 1)!;
    const target = snapshot.entities.find((entity) => entity.team === 2)!;
    const self = withOnlyBasicReady(original);
    const adjusted: WorldSnapshot = {
      ...snapshot,
      entities: snapshot.entities.map((entity) => entity.id === self.id ? self : entity)
    };
    const fallback = selectAbilityAction(adjusted, self, target, getAiProfile('ranged-gunner'));
    const priority = selectAbilityAction(snapshot, original, target, getAiProfile('ranged-gunner'));

    expect(fallback.selected?.slot).toBe('basic');
    expect(fallback.selected?.kind).toBe('primaryAttack');
    expect(priority.selected).not.toBeNull();
    expect(priority.selected?.score).toBeGreaterThanOrEqual(fallback.selected?.score ?? 0);
  });

  it('keeps AI attack facing independent from movement and targets the opponent', () => {
    const runner = duel([
      { fighterId: 'gunner', team: 1, x: 250, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, x: 630, y: 360 }
    ]);
    const snapshot = runner.getSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1)!;
    const commands = new AiController().commandsForTick(snapshot);
    const move = commands.find((command) => command.type === 'move' && command.entityId === self.id);

    expect(move?.type).toBe('move');
    if (move?.type === 'move') {
      expect(move.facing?.x).toBeGreaterThan(0.95);
      expect(Math.abs(move.facing?.y ?? 1)).toBeLessThan(0.1);
    }
  });

  it('lets pointer aim choose the enemy nearest the cursor rather than merely the nearest enemy', () => {
    const runner = duel([
      { fighterId: 'gunner', team: 1, controller: 'player', x: 220, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'ai', x: 430, y: 250 },
      { fighterId: 'water-shaper', team: 2, controller: 'ai', x: 620, y: 410 }
    ]);
    const snapshot = runner.getSnapshot();
    const self = snapshot.entities.find((entity) => entity.team === 1)!;
    const aimed = snapshot.entities.find((entity) => entity.fighterId === 'water-shaper')!;
    const player = new PlayerController();
    player.setControlledEntities([self.id]);
    player.setAimAt({ x: aimed.x, y: aimed.y });
    player.activate('basic');
    const commands = player.commandsForTick(snapshot);
    const attack = commands.find((command) => command.type === 'activatePrimaryAttack');

    expect(attack?.type).toBe('activatePrimaryAttack');
    if (attack?.type === 'activatePrimaryAttack') expect(attack.targetId).toBe(aimed.id);
  });

  it('forces low presentation density for a 100-fighter battle without changing simulation rules', () => {
    const quality = resolveVfxQuality({
      effects: true,
      particleScale: 1,
      reducedMotion: false,
      adaptiveQuality: true,
      performanceScale: 1,
      fighterCount: 100
    });
    expect(quality.tier).toBe('low');
    expect(quality.maxGroundMarks).toBeLessThanOrEqual(8);
    expect(quality.trailSamples).toBeLessThanOrEqual(5);
  });
});
