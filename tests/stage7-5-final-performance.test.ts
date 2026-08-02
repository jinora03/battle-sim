import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAiProfile } from '@kinetic/content';
import { ActionSelectionSpatialContext, selectAbilityAction } from '@kinetic/controllers';
import type { BattleDefinition, EntitySnapshot, WorldSnapshot } from '@kinetic/protocol';
import { LocalSimulationRunner } from '@kinetic/simulation';
import { resolveEliminationProgress } from '../apps/game/src/ui/presentation';

function massSnapshot(): WorldSnapshot {
  const battle: BattleDefinition = {
    seed: 7501,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'rocket-vanguard', team: 1, controller: 'ai', x: 260, y: 350 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'ai', x: 760, y: 350 }
    ],
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, maxBattleTicks: 1_200 }
  };
  const base = new LocalSimulationRunner(battle).getSnapshot();
  const templates = [base.entities[0]!, base.entities[1]!];
  const entities: EntitySnapshot[] = [];
  for (let index = 0; index < 100; index += 1) {
    const team = index < 50 ? 1 : 2;
    const template = templates[team - 1]!;
    const local = index % 50;
    entities.push({
      ...template,
      id: index,
      team,
      x: 100 + (local % 10) * 84 + (team === 2 ? 180 : 0),
      y: 100 + Math.floor(local / 10) * 108,
      abilities: template.abilities.map((ability) => ({ ...ability })),
      statuses: template.statuses.map((status) => ({ ...status })),
      activeZoneIds: [...template.activeZoneIds]
    });
  }
  return { ...base, entities };
}

describe('v1.1 Stage 7.5 final performance architecture', () => {
  it('keeps team-grouped action selection deterministic and exact', () => {
    const snapshot = massSnapshot();
    const self = snapshot.entities[0]!;
    const target = snapshot.entities[50]!;
    const profile = getAiProfile('rocket-artillery');
    const spatial = new ActionSelectionSpatialContext();
    spatial.rebuild(snapshot.entities);

    const baseline = selectAbilityAction(snapshot, self, target, profile, false);
    const optimized = selectAbilityAction(snapshot, self, target, profile, false, spatial);
    expect(optimized.selected).toEqual(baseline.selected);
    const diagnostics = spatial.getDiagnostics();
    expect(diagnostics.hostileQueries).toBeGreaterThan(0);
    expect(diagnostics.areaCandidateChecks).toBeLessThan(diagnostics.hostileQueries * snapshot.entities.length);
  });

  it('uses the original team HP baseline for live elimination progress', () => {
    const progress = resolveEliminationProgress([
      { team: 1, alive: 2, total: 3, hp: 120, maxHp: 300 },
      { team: 2, alive: 1, total: 3, hp: 30, maxHp: 360 }
    ]);
    expect(progress.alive).toBe(3);
    expect(progress.eliminated).toBe(3);
    expect(progress.completionRatio).toBe(0.5);
    expect(progress.teams[0]?.hpRatio).toBe(0.4);
    expect(progress.teams[1]?.hpRatio).toBeCloseTo(1 / 12);
  });

  it('guards renderer startup and caches static obstacle drawing', () => {
    const app = readFileSync(new URL('../apps/game/src/App.tsx', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../apps/game/src/runtime/BattleRuntime.ts', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../packages/renderer-pixi/src/index.ts', import.meta.url), 'utf8');
    const runtimeHook = readFileSync(new URL('../apps/game/src/hooks/useBattleRuntime.ts', import.meta.url), 'utf8');
    expect(runtimeHook).toContain('host?.isConnected && width >= 32 && height >= 32');
    expect(app).toContain('Retry renderer');
    expect(runtime).toContain('private startPromise: Promise<void> | null = null');
    expect(renderer).toContain('private initPromise: Promise<void> | null = null');
    expect(renderer).toContain('if (!changed) return');
  });

  it('renders left-aligned identity, live team lanes and an AI-specific cue', () => {
    const app = readFileSync(new URL('../apps/game/src/App.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../apps/game/src/styles/50-refine.css', import.meta.url), 'utf8');
    const audio = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    expect(app).toContain('className="objective-progress elimination-progress"');
    expect(app).toContain('className="team-progress-fill"');
    expect(css).toContain('justify-items: start');
    expect(audio).toContain('this.playAiHitmarker(strongestAiHit)');
  });
});
