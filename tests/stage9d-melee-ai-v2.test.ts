import { describe, expect, it } from 'vitest';
import { getAiProfile } from '@kinetic/content';
import { AiController, getAiChargedMeleeRepeatLockTicks, selectAbilityAction } from '@kinetic/controllers';
import type { BattleDefinition, EntitySnapshot, WorldSnapshot } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';

function duelSnapshot(fighterAId: string, fighterBId: string, distance = 230): WorldSnapshot {
  const battle: BattleDefinition = {
    seed: 9192,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: fighterAId, team: 1, controller: 'ai', x: 300, y: 340 },
      { fighterId: fighterBId, team: 2, controller: 'ai', x: 300 + distance, y: 340 }
    ],
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 1_200 }
  };
  return new LocalSimulationRunner(battle).getSnapshot();
}

function withOnlySkill1AndBasicReady(snapshot: WorldSnapshot): WorldSnapshot {
  const entities = snapshot.entities.map((entity, index) => {
    if (index !== 0) return entity;
    return {
      ...entity,
      abilities: entity.abilities.map((ability) => ({
        ...ability,
        phase: ability.slot === 'basic' || ability.slot === 'skill1' ? 'ready' as const : 'cooldown' as const,
        cooldownRemainingTicks: ability.slot === 'basic' || ability.slot === 'skill1' ? 0 : Math.max(1, ability.cooldownTotalTicks)
      }))
    } satisfies EntitySnapshot;
  });
  return { ...snapshot, tick: 500, entities };
}

describe('Stage 9D melee AI V2', () => {
  it('uses long AI-only repeat locks for cinematic charges without changing gameplay cooldowns', () => {
    expect(getAiChargedMeleeRepeatLockTicks('driving-slash')).toBe(540);
    expect(getAiChargedMeleeRepeatLockTicks('lance-charge')).toBe(600);
    expect(getAiChargedMeleeRepeatLockTicks('breakthrough-charge')).toBe(780);
    expect(getAiChargedMeleeRepeatLockTicks('crosscut')).toBe(0);
  });

  it('uses sword pressure up close and reserves Driving Slash for an unlocked approach lane', () => {
    const profile = getAiProfile('blade-duelist');

    const closeSnapshot = withOnlySkill1AndBasicReady(duelSnapshot('blade-vanguard', 'iron-lancer', 230));
    const close = selectAbilityAction(
      closeSnapshot,
      closeSnapshot.entities[0]!,
      closeSnapshot.entities[1]!,
      profile,
      true,
      undefined,
      { openingReadiness: false, variationEpoch: 0, chargeLockUntilTick: 0 }
    );
    expect(close.selected).toMatchObject({ kind: 'primaryAttack', abilityId: 'vanguard-longsword' });

    const approachSnapshot = withOnlySkill1AndBasicReady(duelSnapshot('blade-vanguard', 'iron-lancer', 320));
    const available = selectAbilityAction(
      approachSnapshot,
      approachSnapshot.entities[0]!,
      approachSnapshot.entities[1]!,
      profile,
      true,
      undefined,
      { openingReadiness: false, variationEpoch: 0, chargeLockUntilTick: 0 }
    );
    expect(available.selected?.abilityId).toBe('driving-slash');

    const paced = selectAbilityAction(
      approachSnapshot,
      approachSnapshot.entities[0]!,
      approachSnapshot.entities[1]!,
      profile,
      true,
      undefined,
      { openingReadiness: false, variationEpoch: 0, chargeLockUntilTick: approachSnapshot.tick + 200 }
    );
    expect(paced.selected).toBeNull();
  });

  it('keeps one continuous movement/facing command per fighter instead of a plant-to-align override', () => {
    const ai = new AiController(false);
    const snapshot = duelSnapshot('blade-vanguard', 'iron-lancer', 260);
    const commands = ai.commandsForTick(snapshot);
    const moves = commands.filter((command) => command.type === 'move');
    expect(moves).toHaveLength(2);
    for (const move of moves) {
      expect(Math.hypot(move.direction.x, move.direction.y)).toBeGreaterThan(0);
      expect(move.facing).toBeDefined();
    }
  });


  it('creates charge runway by backing away while still using the normal movement command', () => {
    const bladeAi = new AiController(false);
    const bladeSnapshot = duelSnapshot('blade-vanguard', 'iron-lancer', 180);
    const bladeMove = bladeAi.commandsForTick(bladeSnapshot)
      .find((command) => command.type === 'move' && command.entityId === bladeSnapshot.entities[0]!.id);
    expect(bladeMove?.type).toBe('move');
    if (bladeMove?.type === 'move') expect(bladeMove.direction.x).toBeLessThan(0);

    const lancerAi = new AiController(false);
    const lancerSnapshot = duelSnapshot('iron-lancer', 'blade-vanguard', 220);
    const lancerMove = lancerAi.commandsForTick(lancerSnapshot)
      .find((command) => command.type === 'move' && command.entityId === lancerSnapshot.entities[0]!.id);
    expect(lancerMove?.type).toBe('move');
    if (lancerMove?.type === 'move') expect(lancerMove.direction.x).toBeLessThan(0);
  });

  it('reserves charges for approach distances instead of point-blank spam', () => {
    const blade = getAiProfile('blade-duelist').abilityUsage.find((rule) => rule.slot === 'skill1')!;
    const lancer = getAiProfile('iron-charger').abilityUsage.find((rule) => rule.slot === 'skill1')!;
    expect(blade.minDistance).toBeGreaterThanOrEqual(180);
    expect(blade.everyTicks).toBeGreaterThanOrEqual(540);
    expect(lancer.minDistance).toBeGreaterThanOrEqual(220);
    expect(lancer.everyTicks).toBeGreaterThanOrEqual(600);
  });
});
