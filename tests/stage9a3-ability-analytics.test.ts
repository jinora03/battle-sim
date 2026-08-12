import { describe, expect, it } from 'vitest';
import type { SimulationEvent } from '@kinetic/protocol';
import { AbilityAnalyticsCollector, getFighterAbilityAnalytics } from '@kinetic/video-export';

describe('Stage 9A.3 ability analytics', () => {
  it('attributes primary and ability damage without changing the simulation stream', () => {
    const collector = new AbilityAnalyticsCollector();
    collector.beginBattle([
      { id: 1, fighterId: 'gunner', primaryAttackId: 'automatic-rifle' },
      { id: 2, fighterId: 'bomber', primaryAttackId: 'demolition-bomb' }
    ]);

    collector.observeEvents([
      {
        type: 'weaponAttackStarted', tick: 2, entityId: 1, weaponId: 'automatic-rifle', category: 'automatic',
        position: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, windupTicks: 4
      },
      {
        type: 'damage', tick: 8, sourceId: 1, targetId: 2, amount: 5, element: 'metal', hpAfter: 95,
        position: { x: 20, y: 0 }
      },
      {
        type: 'weaponHit', tick: 8, sourceId: 1, targetId: 2, weaponId: 'automatic-rifle',
        position: { x: 20, y: 0 }, damage: 5, knockback: 1
      }
    ] satisfies SimulationEvent[]);

    collector.observeEvents([
      {
        type: 'abilityActivated', tick: 20, entityId: 2, abilityId: 'concussion-bomb', slot: 'skill2',
        position: { x: 20, y: 0 }, direction: { x: -1, y: 0 }, castTicks: 28
      }
    ] satisfies SimulationEvent[]);

    collector.observeEvents([
      {
        type: 'damage', tick: 48, sourceId: 2, targetId: 1, amount: 12, element: 'neutral', hpAfter: 0,
        position: { x: 0, y: 0 }
      },
      {
        type: 'blast', tick: 48, sourceId: 2, abilityId: 'concussion-bomb', kind: 'explosion',
        position: { x: 20, y: 0 }, radius: 155, force: 11, damage: 10, element: 'neutral'
      },
      {
        type: 'abilityResolved', tick: 48, entityId: 2, abilityId: 'concussion-bomb', slot: 'skill2',
        position: { x: 20, y: 0 }, direction: { x: -1, y: 0 }
      },
      { type: 'death', tick: 48, entityId: 1, killerId: 2, position: { x: 0, y: 0 } }
    ] satisfies SimulationEvent[]);

    collector.endBattle();
    const gunner = getFighterAbilityAnalytics(collector.summarize(), 'gunner');
    expect(gunner).not.toBeNull();
    expect(gunner?.battleSamples).toBe(1);
    expect(gunner?.totalDamage).toBe(5);
    expect(gunner?.attributedDamageRate).toBe(1);
    expect(gunner?.primaryAttack.uses).toBe(1);
    expect(gunner?.primaryAttack.damage).toBe(5);

    const bomber = getFighterAbilityAnalytics(collector.summarize(), 'bomber');
    const concussion = bomber?.abilities.find((ability) => ability.actionId === 'concussion-bomb');
    expect(bomber?.totalDamage).toBe(12);
    expect(bomber?.attributedDamageRate).toBe(1);
    expect(concussion?.uses).toBe(1);
    expect(concussion?.resolutions).toBe(1);
    expect(concussion?.completionRate).toBe(1);
    expect(concussion?.damageHits).toBe(1);
    expect(concussion?.damage).toBe(12);
    expect(concussion?.kills).toBe(1);
    expect(concussion?.usageRate).toBe(1);
  });

  it('keeps never-used abilities visible across battle samples', () => {
    const collector = new AbilityAnalyticsCollector();
    for (let battle = 0; battle < 2; battle += 1) {
      collector.beginBattle([
        { id: 1, fighterId: 'pyro-brawler', primaryAttackId: 'flame-fists' },
        { id: 2, fighterId: 'bomber', primaryAttackId: 'demolition-bomb' }
      ]);
      collector.endBattle();
    }

    const pyro = getFighterAbilityAnalytics(collector.summarize(), 'pyro-brawler');
    const flameRing = pyro?.abilities.find((ability) => ability.actionId === 'flame-ring');
    expect(pyro?.battleSamples).toBe(2);
    expect(flameRing?.battleSamples).toBe(2);
    expect(flameRing?.uses).toBe(0);
    expect(flameRing?.usageRate).toBe(0);
    expect(flameRing?.neverUsedRate).toBe(1);
  });
});
