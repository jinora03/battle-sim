import { describe, expect, it, vi } from 'vitest';
import { BattleAudioEngine } from '@kinetic/audio';

interface EngineInternals {
  schedulingAudioTimeSeconds: number | null;
  sourceReservations: WeakMap<AudioScheduledSourceNode, { startsAt: number; endsAt: number; critical: boolean }>;
  activeSources: Set<AudioScheduledSourceNode>;
  abilitySources: Map<string, Set<AudioScheduledSourceNode>>;
  cancelAbilitySourceGroup(groupKey: string): void;
  cancelAllSources(): void;
}

function internals(engine: BattleAudioEngine): EngineInternals {
  return engine as unknown as EngineInternals;
}

function trackedSource(engine: BattleAudioEngine, endsAt: number, groupKey = '1:test') {
  const stop = vi.fn();
  const source = { stop } as unknown as AudioScheduledSourceNode;
  const state = internals(engine);
  state.sourceReservations.set(source, { startsAt: Math.max(0, endsAt - 0.3), endsAt, critical: false });
  state.activeSources.add(source);
  state.abilitySources.set(groupKey, new Set([source]));
  return { source, stop, state };
}

describe('Stage 8.11AB offline export source lifetime safety', () => {
  it('does not extend an already-expired ability source when offline scheduling reaches a later cancel event', () => {
    const engine = new BattleAudioEngine();
    const { stop, state } = trackedSource(engine, 1.34);
    state.schedulingAudioTimeSeconds = 8;

    state.cancelAbilitySourceGroup('1:test');

    expect(stop).not.toHaveBeenCalled();
    expect(state.activeSources.size).toBe(0);
    expect(state.abilitySources.has('1:test')).toBe(false);
  });

  it('still shortens a source that is genuinely active at the cancellation time', () => {
    const engine = new BattleAudioEngine();
    const { source, stop, state } = trackedSource(engine, 9);
    state.schedulingAudioTimeSeconds = 8;

    state.cancelAbilitySourceGroup('1:test');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(8);
    expect(state.sourceReservations.get(source)?.endsAt).toBe(8);
  });

  it('applies the same protection when all tracked sources are cancelled', () => {
    const engine = new BattleAudioEngine();
    const expired = trackedSource(engine, 1.34, '1:a');
    const active = trackedSource(engine, 9, '1:b');
    expired.state.schedulingAudioTimeSeconds = 8;

    expired.state.cancelAllSources();

    expect(expired.stop).not.toHaveBeenCalled();
    expect(active.stop).toHaveBeenCalledWith(8);
    expect(expired.state.activeSources.size).toBe(0);
    expect(expired.state.abilitySources.size).toBe(0);
  });
});
