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

const WATER_ABILITIES = ['surge-dash', 'pressure-wave', 'undertow', 'tidal-cataclysm'] as const;
const THORN_ABILITIES = ['bramble-charge', 'seed-burst', 'regenerate', 'overgrowth'] as const;
const VOID_ABILITIES = ['phase-lunge', 'gravity-well', 'void-burst', 'singularity'] as const;
const STAGE_ABILITIES = [...WATER_ABILITIES, ...THORN_ABILITIES, ...VOID_ABILITIES] as const;

function runFixedSeed(seed: number, fighterA: string, fighterB: string): string {
  const battle: BattleDefinition = {
    seed,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: fighterA, team: 1, controller: 'ai', x: 190, y: 480 },
      { fighterId: fighterB, team: 2, controller: 'ai', x: 530, y: 480 }
    ],
    rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
  };
  const runner = new LocalSimulationRunner(battle);
  const controller = new AiController(false);
  for (let index = 0; index < 1200 && !runner.getSnapshot().battleEnded; index += 1) {
    runner.step(controller.commandsForTick(runner.getRuntimeSnapshot()));
  }
  return checksumSnapshot(runner.getSnapshot());
}

describe('Stage 8.9C remaining roster presentation parity', () => {
  it('registers exactly aligned audio and VFX profiles for the complete playable roster', () => {
    const audioIds = listAbilityCombatAudioProfiles().map((profile) => profile.abilityId);
    const vfxIds = listAbilityCombatVfxProfiles().map((profile) => profile.abilityId);

    expect(audioIds).toHaveLength(48);
    expect(vfxIds).toHaveLength(48);
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

  it('resolves all four intent phases for every converted ability', () => {
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

  it('retains recognizable intent-shaped effects in the budgeted renderer vocabulary', () => {
    for (const abilityId of WATER_ABILITIES) {
      const profile = getAbilityCombatVfxProfile(abilityId)!;
      expect(profile.layers.every((layer) => layer.treatment === 'water-flow')).toBe(true);
    }
    expect(resolveCombatVfxParticleStyle(resolveCombatVfxLayer(getAbilityCombatVfxProfile('surge-dash')!, 'activation')!))
      .toMatchObject({ primary: 'ribbon', secondary: 'droplet' });
    expect(resolveCombatVfxParticleStyle(resolveCombatVfxLayer(getAbilityCombatVfxProfile('pressure-wave')!, 'activation')!))
      .toMatchObject({ primary: 'ribbon', secondary: 'droplet' });

    for (const abilityId of THORN_ABILITIES) {
      const profile = getAbilityCombatVfxProfile(abilityId)!;
      expect(profile.layers.every((layer) => layer.treatment === 'root-growth')).toBe(true);
    }
    expect(resolveCombatVfxParticleStyle(resolveCombatVfxLayer(getAbilityCombatVfxProfile('seed-burst')!, 'activation')!))
      .toMatchObject({ primary: 'wedge', secondary: 'debris' });

    for (const abilityId of VOID_ABILITIES.slice(0, 3)) {
      const profile = getAbilityCombatVfxProfile(abilityId)!;
      expect(profile.layers.every((layer) => layer.treatment === 'void-tear')).toBe(true);
    }
    expect(getAbilityCombatVfxProfile('singularity')?.layers.every((layer) => layer.treatment === 'singularity')).toBe(true);
    expect(resolveCombatVfxParticleStyle(resolveCombatVfxLayer(getAbilityCombatVfxProfile('void-burst')!, 'activation')!))
      .toMatchObject({ primary: 'streak', secondary: 'ring-fragment' });
  });

  it('removes the twelve fighter-specific legacy audio resolution branches', () => {
    const source = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    for (const abilityId of STAGE_ABILITIES) {
      expect(source).not.toContain(`id === '${abilityId}'`);
      expect(source).not.toContain(`abilityId === '${abilityId}'`);
    }
    expect(source).toContain("layer.variant === 'water-pressure'");
    expect(source).toContain("layer.variant === 'organic-growth'");
    expect(source).toContain("layer.variant === 'void-compression'");
    expect(source).toContain("layer.variant === 'singularity-collapse'");
  });

  it('uses reusable renderer treatments without fighter or ability ID checks', () => {
    const full = readFileSync(new URL('../packages/renderer-pixi/src/effects/FxEngine.ts', import.meta.url), 'utf8');
    const budgeted = readFileSync(new URL('../packages/renderer-pixi/src/layeredVfx.ts', import.meta.url), 'utf8');
    for (const abilityId of STAGE_ABILITIES) {
      expect(full).not.toContain(`layer.abilityId === '${abilityId}'`);
      expect(budgeted).not.toContain(`layer.abilityId === '${abilityId}'`);
    }
    for (const treatment of ['water-flow', 'root-growth', 'void-tear', 'singularity']) {
      expect(full).toContain(`layer.treatment === '${treatment}'`);
      expect(budgeted).toContain(`layer.treatment === '${treatment}'`);
    }
    expect(full).toContain("layer.treatment === 'root-growth' || layer.treatment === 'singularity'");
    expect(budgeted).toContain("layer.treatment === 'root-growth' || layer.treatment === 'singularity'");
  });

  it('preserves fixed-seed simulation determinism', () => {
    expect(runFixedSeed(89031, 'water-shaper', 'thorn-colossus')).toBe(runFixedSeed(89031, 'water-shaper', 'thorn-colossus'));
    expect(runFixedSeed(89032, 'void-reaper', 'water-shaper')).toBe(runFixedSeed(89032, 'void-reaper', 'water-shaper'));
  });
});
