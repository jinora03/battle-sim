import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { metaEvaluationIntervalForEntityCount } from '../apps/game/src/runtime/performance';
import { resolveMassBattleRenderPolicy } from '../packages/renderer-pixi/src/massBattlePolicy';

describe('v1.1 Stage 7.4 performance phase 6', () => {
  it('uses stable 30 FPS mass presentation beginning at 48 fighters', () => {
    expect(resolveMassBattleRenderPolicy(47, 60, 1).tier).toBe('crowd');
    const policy = resolveMassBattleRenderPolicy(48, 60, 1);
    expect(policy.tier).toBe('mass');
    expect(policy.targetFps).toBe(30);
    expect(policy.maxResidualEffects).toBeLessThan(120);
    expect(policy.maxWeaponEffects).toBeLessThan(20);
  });

  it('batches achievement evaluation only for larger battles', () => {
    expect(metaEvaluationIntervalForEntityCount(2)).toBe(1);
    expect(metaEvaluationIntervalForEntityCount(50)).toBe(12);
  });

  it('guards viewport state and renderer resizing against no-op updates', () => {
    const app = readFileSync(new URL('../apps/game/src/App.tsx', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../packages/renderer-pixi/src/index.ts', import.meta.url), 'utf8');
    expect(app).toContain('sameViewportMetrics(current, nextViewport) ? current : nextViewport');
    expect(renderer).toContain('if (!sizeChanged && !resolutionChanged) return');
  });

  it('keeps the replay export centered and restores an explicit AI hitmarker path', () => {
    const app = readFileSync(new URL('../apps/game/src/App.tsx', import.meta.url), 'utf8');
    const audio = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    expect(app).toContain('className="debug-export-row"');
    expect(audio).toContain('this.playAiHitmarker(strongestAiHit)');
    expect(audio).toContain('aiEntityIds: readonly number[] = []');
  });
});
