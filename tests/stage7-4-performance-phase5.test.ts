import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ProjectileSnapshot, SimulationEvent } from '@kinetic/protocol';
import {
  budgetPresentationEvents,
  resolveMassBattleRenderPolicy,
  selectProjectileVisuals
} from '../packages/renderer-pixi/src/massBattlePolicy';

describe('v1.1 Stage 7.4 performance phase 5', () => {
  it('caps a 50v50 presentation at 30 FPS without changing the 60 Hz simulation', () => {
    const policy = resolveMassBattleRenderPolicy(100, 60, 1);
    expect(policy.tier).toBe('mass');
    expect(policy.targetFps).toBe(30);
    expect(policy.maxPresentationEvents).toBe(32);
    expect(policy.maxProjectileVisuals).toBe(64);

    const crowd = resolveMassBattleRenderPolicy(50, 60, 1);
    expect(crowd.tier).toBe('mass');
    expect(crowd.targetFps).toBe(30);
  });

  it('keeps critical and player-related events inside the mass-battle visual budget', () => {
    const events: SimulationEvent[] = Array.from({ length: 80 }, (_, index) => ({
      type: 'impact' as const,
      tick: index,
      a: index + 10,
      b: index + 110,
      position: { x: index, y: index },
      magnitude: 1,
      relativeSpeed: 1
    }));
    events.push({
      type: 'damage', tick: 81, sourceId: 1, targetId: 2, amount: 5, element: 'neutral', hpAfter: 95,
      position: { x: 0, y: 0 }
    });
    events.push({ type: 'death', tick: 82, entityId: 42, position: { x: 0, y: 0 } });
    events.push({ type: 'battleEnded', tick: 83, winningTeam: 1, reason: 'elimination', winnerEntityIds: [1] });

    const selected = budgetPresentationEvents(events, 16, new Set([1]));
    expect(selected).toHaveLength(16);
    expect(selected.some((event) => event.type === 'damage' && event.sourceId === 1)).toBe(true);
    expect(selected.some((event) => event.type === 'death')).toBe(true);
    expect(selected.some((event) => event.type === 'battleEnded')).toBe(true);
  });

  it('prioritizes player projectiles while sampling the remaining projectile visuals', () => {
    const projectiles: ProjectileSnapshot[] = Array.from({ length: 120 }, (_, index) => ({
      id: index,
      sourceId: index < 4 ? 1 : index + 10,
      team: index % 2 === 0 ? 1 : 2,
      weaponId: 'automatic-rifle',
      category: 'automatic',
      x: index,
      y: 0,
      prevX: index - 1,
      prevY: 0,
      vx: 1,
      vy: 0,
      radius: 2,
      alive: true,
      fuseRemainingTicks: 0,
      arcHeight: 0,
      rotation: 0
    }));

    const selected = selectProjectileVisuals(projectiles, 24, new Set([1]));
    expect(selected).toHaveLength(24);
    expect(selected.filter((projectile) => projectile.sourceId === 1)).toHaveLength(4);
  });

  it('boots Pixi only after the Fight workspace has a visible layout', () => {
    const source = readFileSync(new URL('../apps/game/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain("if (view !== 'battle')");
    expect(source).toContain('await afterVisibleLayout()');
    expect(source).toContain('runtimeBootRef.current ?? runtime.start()');
    expect(source).not.toContain('void runtime.start()');
  });
});
