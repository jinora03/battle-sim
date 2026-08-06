import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_AUDIO_PHASES,
  getAbilityCombatAudioProfile,
  listAbilityCombatAudioProfiles,
  resolveCombatAudioLayer
} from '@kinetic/audio';
import { listAbilities } from '@kinetic/content';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import {
  COMBAT_VFX_PHASES,
  getAbilityCombatVfxProfile,
  listAbilityCombatVfxProfiles,
  resolveCombatVfxLayer,
  resolveCombatVfxParticleStyle
} from '@kinetic/visual-engine';

const FROST_ABILITIES = ['glacier-charge', 'frost-nova', 'ice-anchor', 'absolute-zero'] as const;
const ROCKET_ABILITIES = ['rocket-salvo', 'blast-jump', 'siege-marker', 'starburst-convergence'] as const;
const STAGE_ABILITIES = [...FROST_ABILITIES, ...ROCKET_ABILITIES] as const;

function runFixedSeed(seed: number): string {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'frost-warden', team: 1, controller: 'ai', x: 190, y: 480 },
      { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
    ],
    rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
  };
  const runner = new LocalSimulationRunner(battle);
  const controller = new AiController(false);
  for (let index = 0; index < 1200 && !runner.getSnapshot().battleEnded; index += 1) {
    const snapshot = runner.getRuntimeSnapshot();
    runner.step(controller.commandsForTick(snapshot));
  }
  return checksumSnapshot(runner.getSnapshot());
}

describe('Stage 8.9B Frost Warden and Rocket Vanguard presentation parity', () => {
  it('registers aligned audio and VFX profiles for all eight abilities', () => {
    const audioProfiles = listAbilityCombatAudioProfiles();
    const vfxProfiles = listAbilityCombatVfxProfiles();
    const audioIds = audioProfiles.map((profile) => profile.abilityId);
    const vfxIds = vfxProfiles.map((profile) => profile.abilityId);

    expect(audioIds.length).toBe(vfxIds.length);
    expect(new Set(audioIds).size).toBe(audioIds.length);
    expect(new Set(vfxIds).size).toBe(vfxIds.length);
    expect([...audioIds].sort()).toEqual([...vfxIds].sort());

    for (const abilityId of STAGE_ABILITIES) {
      expect(getAbilityCombatAudioProfile(abilityId), `${abilityId} audio`).toBeDefined();
      expect(getAbilityCombatVfxProfile(abilityId), `${abilityId} VFX`).toBeDefined();
    }
  });

  it('keeps every registered presentation profile connected to real content', () => {
    const contentIds = new Set(listAbilities().map((ability) => ability.id));
    for (const profile of listAbilityCombatAudioProfiles()) expect(contentIds.has(profile.abilityId), profile.abilityId).toBe(true);
    for (const profile of listAbilityCombatVfxProfiles()) expect(contentIds.has(profile.abilityId), profile.abilityId).toBe(true);
  });

  it('resolves complete anticipation, activation, sustain and release lifecycles', () => {
    for (const abilityId of STAGE_ABILITIES) {
      const audio = getAbilityCombatAudioProfile(abilityId)!;
      const vfx = getAbilityCombatVfxProfile(abilityId)!;
      for (const phase of COMBAT_AUDIO_PHASES) {
        const layer = resolveCombatAudioLayer(audio, phase, 42);
        expect(layer, `${abilityId} ${phase} audio`).toBeDefined();
        expect(layer?.durationSeconds ?? 0).toBeGreaterThan(0);
      }
      for (const phase of COMBAT_VFX_PHASES) {
        const layer = resolveCombatVfxLayer(vfx, phase, 42);
        expect(layer, `${abilityId} ${phase} VFX`).toBeDefined();
        expect(layer?.durationSeconds ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('retains recognizable sharp silhouettes in the budgeted VFX path', () => {
    for (const abilityId of FROST_ABILITIES) {
      const profile = getAbilityCombatVfxProfile(abilityId)!;
      for (const phase of COMBAT_VFX_PHASES) {
        const layer = resolveCombatVfxLayer(profile, phase)!;
        const style = resolveCombatVfxParticleStyle(layer);
        expect([style.primary, style.secondary]).toEqual(expect.arrayContaining([
          expect.stringMatching(/shard|streak|ring-fragment/)
        ]));
        expect(layer.treatment).toBe('crystalline');
      }
    }

    expect(resolveCombatVfxLayer(getAbilityCombatVfxProfile('rocket-salvo')!, 'activation')).toMatchObject({
      directional: true,
      treatment: 'rocket-exhaust'
    });
    expect(resolveCombatVfxLayer(getAbilityCombatVfxProfile('siege-marker')!, 'anticipation')?.treatment).toBe('target-lock');
    expect(resolveCombatVfxLayer(getAbilityCombatVfxProfile('starburst-convergence')!, 'release')?.treatment).toBe('starburst');
  });

  it('removes Frost legacy resolution branches and prevents Rocket generic ability fallback', () => {
    const source = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    for (const abilityId of STAGE_ABILITIES) {
      expect(source).not.toContain(`id === '${abilityId}'`);
    }
    expect(source).toContain("layer.variant === 'crystalline-fracture'");
    expect(source).toContain("layer.variant === 'rocket-ignition'");
    expect(source).toContain("layer.variant === 'target-lock'");
    expect(source).toContain("layer.variant === 'starburst-finale'");
  });

  it('uses reusable renderer treatments without fighter or ability ID branches', () => {
    const full = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    const budgeted = readFileSync(new URL('../packages/renderer-pixi/src/layeredVfx.ts', import.meta.url), 'utf8');
    for (const abilityId of STAGE_ABILITIES) {
      expect(full).not.toContain(`layer.abilityId === '${abilityId}'`);
      expect(budgeted).not.toContain(`layer.abilityId === '${abilityId}'`);
    }
    expect(full).toContain("layer.treatment === 'crystalline'");
    expect(full).toContain("layer.treatment === 'rocket-exhaust'");
    expect(budgeted).toContain("layer.treatment === 'target-lock'");
    expect(budgeted).toContain("layer.treatment === 'starburst'");
  });

  it('preserves fixed-seed simulation determinism', () => {
    expect(runFixedSeed(89021)).toBe(runFixedSeed(89021));
    expect(runFixedSeed(89022)).toBe(runFixedSeed(89022));
  });
});
