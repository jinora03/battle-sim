import { describe, expect, it } from 'vitest';
import {
  getAbilityCombatAudioProfile,
  listAbilityCombatAudioProfiles
} from '@kinetic/audio';
import { CONTENT_VERSION, getAiProfile, getFighter, listAiProfiles } from '@kinetic/content';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { ENGINE_VERSION, LocalSimulationRunner } from '@kinetic/simulation';

const PYRO_ABILITIES = ['magma-dash', 'flame-ring', 'molten-guard', 'inferno-collapse'] as const;
const BALLAST_ABILITIES = ['featherfall', 'downbeat', 'dead-weight', 'last-call'] as const;

function sentinelTrainingBattle(): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8611,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'solar-sentinel', team: 1, controller: 'ai', x: 240, y: 360 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 760, y: 360 }
    ],
    rules: {
      friendlyFire: false,
      teamCollision: 'ghost',
      maxBattleTicks: 900,
      training: {
        enabled: true,
        damageEnabled: true,
        cooldownsEnabled: true,
        suppressVictory: true
      }
    }
  };
  return new LocalSimulationRunner(battle);
}

describe('Stage 8.6C-1 Pyro, Ballast and Solar Sentinel correction', () => {
  it('migrates every Pyro and Ballast ability to intent-based audio', () => {
    const ids = new Set(listAbilityCombatAudioProfiles().map((profile) => profile.abilityId));
    for (const abilityId of [...PYRO_ABILITIES, ...BALLAST_ABILITIES]) {
      expect(ids.has(abilityId), `${abilityId} should have an intent audio profile`).toBe(true);
      expect(getAbilityCombatAudioProfile(abilityId)?.layers.activation).toBeDefined();
    }
  });

  it('keeps payoff and ultimate sounds above ordinary skills', () => {
    expect(getAbilityCombatAudioProfile('magma-dash')?.hierarchy).toBe('skill');
    expect(getAbilityCombatAudioProfile('molten-guard')?.hierarchy).toBe('payoff');
    expect(getAbilityCombatAudioProfile('inferno-collapse')?.hierarchy).toBe('ultimate');

    expect(getAbilityCombatAudioProfile('featherfall')?.hierarchy).toBe('skill');
    expect(getAbilityCombatAudioProfile('downbeat')?.hierarchy).toBe('payoff');
    expect(getAbilityCombatAudioProfile('last-call')?.hierarchy).toBe('ultimate');
  });

  it('gives Pyro and Ballast distinct fire and gravity palettes', () => {
    for (const abilityId of PYRO_ABILITIES) {
      expect(getAbilityCombatAudioProfile(abilityId)?.palette).toBe('fire');
    }
    for (const abilityId of BALLAST_ABILITIES) {
      expect(getAbilityCombatAudioProfile(abilityId)?.palette).toBe('gravity');
    }
  });

  it('keeps the reusable aggressive-brawler profile available to Fighter Creator bundles', () => {
    expect(listAiProfiles().some((profile) => profile.id === 'aggressive-brawler')).toBe(true);
  });

  it('removes the unrelated Pyro heat gate from Solar Sentinel AI', () => {
    const fighter = getFighter('solar-sentinel');
    expect(fighter.aiProfileId).toBe('solar-sentinel');

    const profile = getAiProfile('solar-sentinel');
    const ultimateRule = profile.abilityUsage.find((rule) => rule.slot === 'ultimate');
    expect(ultimateRule).toMatchObject({ minDistance: 90, maxDistance: 1080, priority: 28 });
    expect(ultimateRule?.selfResourceId).toBeUndefined();
    expect(ultimateRule?.minimumSelfResource).toBeUndefined();
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.10-stage8.6c1');
    expect(ENGINE_VERSION).toBe('1.3.10-stage8.6c1');
  });

  it('lets Solar Sentinel AI select and begin Solar Eye Beams', () => {
    const runner = sentinelTrainingBattle();
    const controller = new AiController(false);
    const commands = controller.commandsForTick(runner.getSnapshot());
    const ultimateCommand = commands.find(
      (command) => command.type === 'activateAbility' && command.slot === 'ultimate'
    );

    expect(ultimateCommand).toMatchObject({
      type: 'activateAbility',
      entityId: 0,
      slot: 'ultimate',
      targetId: 1
    });

    const events = runner.step(commands);
    expect(events.some(
      (event) => event.type === 'abilityActivated'
        && event.entityId === 0
        && event.abilityId === 'solar-laser'
    )).toBe(true);
  });
});
