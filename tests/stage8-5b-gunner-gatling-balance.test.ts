import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isGunnerRifleRound } from '@kinetic/audio';
import {
  CONTENT_VERSION,
  getAbility,
  getFighter,
  getPrimaryAttack,
  getProjectileSource,
  getStatus,
  listCompatibleModules
} from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { checksumSnapshot, ENGINE_VERSION, LocalSimulationRunner } from '@kinetic/simulation';
import { getSkillPresentation, getWeaponVfxRecipe } from '@kinetic/visual-engine';
import { isRapidFireWeapon, resolveWeaponHitFreezeMs } from '../packages/renderer-pixi/src/combatFeedback';

function gatlingTraining(): BattleDefinition {
  return {
    seed: 8512,
    arenaId: 'training-grid',
    modeId: 'training',
    participants: [
      { fighterId: 'gunner', team: 1, controller: 'player', x: 170, y: 470 },
      { fighterId: 'mech-bruiser', team: 2, controller: 'player', x: 650, y: 470 }
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

function runKillZone(): { events: SimulationEvent[]; checksum: string } {
  const runner = new LocalSimulationRunner(gatlingTraining());
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < 100; tick += 1) {
    const commands: SimulationCommand[] = tick === 0
      ? [
          { type: 'activateAbility', entityId: 0, slot: 'ultimate', targetId: 1, direction: { x: 1, y: 0 } },
          { type: 'stop', entityId: 1 }
        ]
      : [{ type: 'stop', entityId: 1 }];
    events.push(...runner.step(commands));
  }
  return { events, checksum: checksumSnapshot(runner.getSnapshot()) };
}

describe('Stage 8.5B Gunner gatling and balance pass', () => {
  it('replaces Kill Zone missiles with a sustained 24-round gatling barrage', () => {
    const ability = getAbility('kill-zone');
    const launch = ability.triggers[0]?.actions.find((action) => action.type === 'LAUNCH_PROJECTILES');
    expect(launch).toMatchObject({
      type: 'LAUNCH_PROJECTILES',
      projectileId: 'kill-zone-round',
      count: 24,
      pattern: 'fan',
      intervalTicks: 2
    });
    expect(JSON.stringify(ability)).not.toContain('missile');

    const round = getProjectileSource('kill-zone-round');
    expect(round.form).toBe('rifle');
    expect(round.behavior).toBe('automatic');
    expect(round.projectile).toBeDefined();
    expect(round.projectile!.explosionRadius).toBe(0);
    expect(round.projectile!.explosionDamage).toBe(0);
    expect(round.projectile!.trailStyle).not.toBe('smoke');
  });

  it('launches all gatling rounds without explosions and remains deterministic', () => {
    const first = runKillZone();
    const second = runKillZone();
    const spawns = first.events.filter((event) => event.type === 'projectileSpawned');

    expect(spawns.filter((event) => event.weaponId === 'kill-zone-round')).toHaveLength(24);
    expect(spawns.some((event) => event.weaponId.includes('missile'))).toBe(false);
    expect(first.events.some((event) => event.type === 'blast')).toBe(false);
    expect(first.checksum).toBe(second.checksum);
  });

  it('reduces Gunner opening damage while preserving the four-round rifle identity', () => {
    const gunner = getFighter('gunner');
    const rifle = getPrimaryAttack(gunner.primaryAttackId);
    const suppressive = getProjectileSource('suppressive-round');
    const pinning = getProjectileSource('pinning-round-projectile');
    const gatling = getProjectileSource('kill-zone-round');

    expect(rifle.burstCount).toBe(4);
    expect(rifle.damage).toBe(2.8);
    expect(rifle.cooldownTicks).toBe(38);
    expect(rifle.damage * rifle.burstCount!).toBe(11.2);
    expect(suppressive.damage).toBe(2.25);
    expect(pinning.damage).toBe(9);
    expect(pinning.statusInteraction?.bonusDamagePerStack).toBe(3.2);
    expect(gatling.damage * 24).toBeCloseTo(37.2, 5);
  });

  it('treats gatling rounds as rapid rifle bullets with no repeated hit-stop', () => {
    expect(isGunnerRifleRound('kill-zone-round')).toBe(true);
    expect(isRapidFireWeapon('kill-zone-round')).toBe(true);
    expect(resolveWeaponHitFreezeMs({ weaponId: 'kill-zone-round', damage: 4 })).toBe(0);
    expect(getWeaponVfxRecipe('kill-zone-round')).toMatchObject({
      weaponId: 'kill-zone-round',
      muzzleFlash: true,
      groundMark: 'none'
    });
  });

  it('keeps the old module id compatible while replacing the missile fantasy', () => {
    const module = listCompatibleModules(getFighter('gunner')).find((item) => item.id === 'shoulder-missile-pod');
    expect(module).toMatchObject({ id: 'shoulder-missile-pod', name: 'Rotary Ammo Drum' });
    expect(module?.attachments?.[0]?.kind).toBe('ammo-drum');
    expect(module?.description.toLowerCase()).not.toContain('missile');
  });

  it('registers the overdrive presentation and intent-specific layered audio', () => {
    expect(getStatus('kill-zone-overdrive')).toBeDefined();
    expect(getSkillPresentation('kill-zone').resolve).toBe('gatling-overdrive');

    const projectileSource = readFileSync(new URL('../packages/renderer-pixi/src/projectiles/ProjectileLayer.ts', import.meta.url), 'utf8');
    expect(projectileSource).toContain('GUNNER_BULLET_IDS');
    expect(projectileSource).toContain('0xc88a36');
    expect(projectileSource).toContain('tracerLength');

    const audioSource = readFileSync(new URL('../packages/audio/src/index.ts', import.meta.url), 'utf8');
    expect(audioSource).toContain('playKillZoneSpool');
    expect(audioSource).toContain('playGatlingRound');
    expect(audioSource).toContain("id === 'tactical-slide'");
    expect(audioSource).toContain("id === 'suppressive-fire'");
    expect(audioSource).toContain("id === 'pinning-round'");
  });

  it('advances engine and content compatibility markers together', () => {
    expect(CONTENT_VERSION).toBe('1.3.6-stage8.5b');
    expect(ENGINE_VERSION).toBe('1.3.6-stage8.5b');
  });
});
