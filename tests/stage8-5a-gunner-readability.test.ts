import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isGunnerRifleRound } from '@kinetic/audio';
import { CONTENT_VERSION, getAiProfile, getFighter, getPrimaryAttack } from '@kinetic/content';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition, MoveCommand, ProjectileSpawnedEvent, SimulationCommand } from '@kinetic/protocol';
import { checksumSnapshot, ENGINE_VERSION, LocalSimulationRunner } from '@kinetic/simulation';
import { getWeaponVfxRecipe } from '@kinetic/visual-engine';
import { isRapidFireWeapon, resolveWeaponHitFreezeMs } from '../packages/renderer-pixi/src/combatFeedback';

function trainingBattle(controller: 'ai' | 'player' = 'player'): BattleDefinition {
  return {
    seed: 8501,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'gunner', team: 1, controller, x: 150, y: 470 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 700, y: 470 }
    ],
    rules: {
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
}

function move(entityId: number, x: number, y: number): MoveCommand {
  return { type: 'move', entityId, direction: { x, y } };
}

function moveFor(commands: readonly SimulationCommand[], entityId: number): MoveCommand {
  const command = commands.find((item): item is MoveCommand => item.type === 'move' && item.entityId === entityId);
  if (!command) throw new Error(`Missing move command for entity ${entityId}`);
  return command;
}

function trackedBurstChecksum(): string {
  const runner = new LocalSimulationRunner(trainingBattle('player'));
  const spawned: ProjectileSpawnedEvent[] = [];
  let firstRoundLaunched = false;
  for (let tick = 0; tick < 30; tick += 1) {
    const commands: SimulationCommand[] = tick === 0
      ? [
          { type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } },
          move(1, 0, 0)
        ]
      : [move(1, 0, firstRoundLaunched ? 1 : 0)];
    const events = runner.step(commands);
    for (const event of events) {
      if (event.type === 'projectileSpawned' && event.weaponId === 'automatic-rifle') spawned.push(event);
    }
    if (spawned.length > 0) firstRoundLaunched = true;
  }
  expect(spawned).toHaveLength(4);
  expect(spawned.at(-1)!.velocity.y).toBeGreaterThan(spawned[0]!.velocity.y + 0.2);
  return checksumSnapshot(runner.getSnapshot());
}

describe('Stage 8.5A Gunner readability pass', () => {
  it('keeps the four-round rifle while moving Gunner into a disciplined firing lane', () => {
    const fighter = getFighter('gunner');
    const rifle = getPrimaryAttack(fighter.primaryAttackId);
    const profile = getAiProfile(fighter.aiProfileId!);

    expect(rifle.id).toBe('automatic-rifle');
    expect(rifle.burstCount).toBe(4);
    expect(rifle.style).toBe('burst');
    expect(profile.preferredDistance).toBe(440);
    expect(profile.movementStyle).toBe('kite');
    expect(profile.aggression).toBe(0.76);
    expect(profile.orbitStrength).toBe(0.58);
  });

  it('reduces forward pressure and increases strafing while the burst is committed', () => {
    const runner = new LocalSimulationRunner(trainingBattle('ai'));
    const idle = moveFor(new AiController(false).commandsForTick(runner.getRuntimeSnapshot()), 0);

    runner.step([
      { type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } },
      move(1, 0, 0)
    ]);
    const committed = moveFor(new AiController(false).commandsForTick(runner.getRuntimeSnapshot()), 0);

    expect(committed.direction.x).toBeLessThan(idle.direction.x);
    expect(Math.abs(committed.direction.y)).toBeGreaterThan(Math.abs(idle.direction.y));
  });

  it('tracks a moving selected target between burst rounds without steering launched bullets', () => {
    expect(trackedBurstChecksum()).toBe(trackedBurstChecksum());
  });

  it('removes repeated hit-stop from rapid rifle rounds while preserving the Pinning Round payoff', () => {
    for (const weaponId of ['automatic-rifle', 'tactical-round', 'suppressive-round']) {
      expect(isRapidFireWeapon(weaponId)).toBe(true);
      expect(resolveWeaponHitFreezeMs({ weaponId, damage: 8 })).toBe(0);
    }
    expect(isRapidFireWeapon('pinning-round-projectile')).toBe(false);
    expect(resolveWeaponHitFreezeMs({ weaponId: 'pinning-round-projectile', damage: 10 })).toBeGreaterThan(0);
  });

  it('registers rifle VFX and audio identity for the basic and all skill rounds', () => {
    for (const weaponId of ['automatic-rifle', 'tactical-round', 'suppressive-round', 'pinning-round-projectile']) {
      expect(getWeaponVfxRecipe(weaponId).weaponId).toBe(weaponId);
      expect(getWeaponVfxRecipe(weaponId).muzzleFlash).toBe(true);
      expect(isGunnerRifleRound(weaponId)).toBe(true);
    }
  });

  it('draws a more readable stock, receiver, scope, magazine and muzzle-brake silhouette', () => {
    const source = readFileSync(new URL('../packages/renderer-pixi/src/fighters/FighterView.ts', import.meta.url), 'utf8');
    expect(source).toContain('Rear stock makes the rifle silhouette readable');
    expect(source).toContain('receiverW');
    expect(source).toContain('size * 0.4');
    expect(source).toContain('size * 1.34');
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.5-stage8.5a');
    expect(ENGINE_VERSION).toBe('1.3.5-stage8.5a');
  });
});
