import { describe, expect, it } from 'vitest';
import {
  getAbilityCombatAudioProfile,
  listAbilityCombatAudioProfiles
} from '@kinetic/audio';
import { CONTENT_VERSION, getAiProfile, getFighter, listAiProfiles } from '@kinetic/content';
import { AiController, getAiOpeningReadyTick } from '@kinetic/controllers';
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
        damageEnabled: false,
        cooldownsEnabled: true,
        invulnerableTeams: [1, 2],
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
    expect(CONTENT_VERSION).toBe('1.3.16-stage8.7b');
    expect(ENGINE_VERSION).toBe('1.3.16-stage8.7b');
  });

  it('lets Solar Sentinel use Solar Eye Beams after its seeded opening lockout', () => {
    const runner = sentinelTrainingBattle();
    const controller = new AiController(false);
    const initial = runner.getSnapshot();
    const openingReadyTick = getAiOpeningReadyTick(initial.seed, 0, 'ultimate', 'solar-laser', 'offensive');
    const initialCommands = controller.commandsForTick(initial);

    expect(initialCommands.some(
      (command) => command.type === 'activateAbility' && command.slot === 'ultimate'
    )).toBe(false);
    expect(runner.step(initialCommands).some(
      (event) => event.type === 'abilityActivated' && event.abilityId === 'solar-laser'
    )).toBe(false);

    let activatedTick: number | null = null;
    for (let tick = 0; tick < openingReadyTick + 300 && activatedTick === null; tick += 1) {
      const snapshot = runner.getRuntimeSnapshot();
      const events = runner.step(controller.commandsForTick(snapshot));
      if (events.some(
        (event) => event.type === 'abilityActivated'
          && event.entityId === 0
          && event.abilityId === 'solar-laser'
      )) activatedTick = snapshot.tick;
    }

    expect(activatedTick).not.toBeNull();
    expect(activatedTick ?? 0).toBeGreaterThanOrEqual(openingReadyTick);
  });
});
