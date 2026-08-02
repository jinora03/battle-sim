import { describe, expect, it } from 'vitest';
import {
  getFighter,
  listCompatibleModules,
  listMountedAttachments,
  resolveFighterLoadout
} from '@kinetic/content';
import type { BattleDefinition, SimulationCommand, SimulationEvent } from '@kinetic/protocol';
import { LocalSimulationRunner, SeededRng, World } from '@kinetic/simulation';
import { resolveMountedAttachmentPose } from '../packages/renderer-pixi/src/mountedAttachments';

function runTicks(
  runner: LocalSimulationRunner,
  ticks: number,
  commandsForTick: (tick: number) => SimulationCommand[]
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runner.step(commandsForTick(tick)));
  return events;
}

function gunnerDuel(defenderModuleIds: string[] = [], attackerModuleIds: string[] = []): LocalSimulationRunner {
  const battle: BattleDefinition = {
    seed: 8101,
    arenaId: 'iron-pit',
    modeId: 'duel',
    participants: [
      { fighterId: 'gunner', team: 1, controller: 'player', x: 180, y: 470, loadout: { moduleIds: attackerModuleIds } },
      { fighterId: 'gunner', team: 2, controller: 'player', x: 470, y: 470, loadout: { moduleIds: defenderModuleIds } }
    ],
    rules: {
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

const stopDefender = (): SimulationCommand => ({ type: 'stop', entityId: 1 });

describe('Stage 8.1 data-driven mounted attachments', () => {
  it('exposes developer-approved modules in all four slots', () => {
    const gunner = getFighter('gunner');
    expect(listCompatibleModules(gunner, 'offense').map((module) => module.id)).toEqual([
      'ricochet-chamber',
      'piercing-barrel',
      'shoulder-missile-pod'
    ]);
    expect(listCompatibleModules(gunner, 'defense').map((module) => module.id)).toEqual(['deflector-plate']);
    expect(listCompatibleModules(gunner, 'mobility').map((module) => module.id)).toEqual(['recoil-thrusters']);
    expect(listCompatibleModules(gunner, 'utility').map((module) => module.id)).toEqual(['targeting-drone']);
  });

  it('resolves modules, modifiers and attachment recipes in deterministic slot order', () => {
    const resolved = resolveFighterLoadout(getFighter('gunner'), {
      moduleIds: ['targeting-drone', 'recoil-thrusters', 'deflector-plate', 'shoulder-missile-pod']
    });

    expect(resolved.moduleIds).toEqual([
      'shoulder-missile-pod',
      'deflector-plate',
      'recoil-thrusters',
      'targeting-drone'
    ]);
    expect(resolved.mountedAttachments.map((attachment) => attachment.id)).toEqual([
      'gunner-shoulder-missile-pod',
      'gunner-deflector-plate',
      'gunner-recoil-thruster-left',
      'gunner-recoil-thruster-right',
      'gunner-targeting-drone'
    ]);
    expect(resolved.skillProjectileDamageMultiplier).toBeCloseTo(1.12);
    expect(resolved.incomingDamageMultiplier).toBeCloseTo(0.9);
    expect(resolved.moveAccelerationMultiplier).toBeCloseTo(1.14);
  });

  it('clones attachment recipes instead of exposing mutable registry state', () => {
    const first = listMountedAttachments(['targeting-drone']);
    first[0]!.scale = 99;
    const second = listMountedAttachments(['targeting-drone']);
    expect(second[0]?.scale).toBe(1.12);
  });

  it('computes stable body and orbit mount poses without simulation state branches', () => {
    const [thruster] = listMountedAttachments(['recoil-thrusters']);
    const [drone] = listMountedAttachments(['targeting-drone']);
    const context = {
      entityId: 4,
      radius: 35,
      elapsedSeconds: 1.5,
      counterRotation: -0.4,
      reducedMotion: false,
      lod: 'hero' as const
    };

    const thrusterPose = resolveMountedAttachmentPose(thruster!, context);
    const dronePose = resolveMountedAttachmentPose(drone!, context);
    expect(thrusterPose.x).toBeLessThan(0);
    expect(Math.hypot(dronePose.x, dronePose.y)).toBeCloseTo(35 * 1.9, 5);
  });

  it('applies mobility modifiers once when the fighter spawns', () => {
    const base = new World(4);
    const modified = new World(4);
    const baseId = base.spawn({ fighterId: 'gunner', team: 1, controller: 'player' }, 100, 100, new SeededRng(1));
    const modifiedId = modified.spawn({
      fighterId: 'gunner',
      team: 1,
      controller: 'player',
      loadout: { moduleIds: ['recoil-thrusters'] }
    }, 100, 100, new SeededRng(1));

    expect(modified.maxSpeed[modifiedId]).toBeCloseTo((base.maxSpeed[baseId] ?? 0) * 1.06);
    expect(modified.moveAcceleration[modifiedId]).toBeCloseTo((base.moveAcceleration[baseId] ?? 0) * 1.14);
  });

  it('reduces incoming damage through the defensive module', () => {
    const firstPrimaryDamage = (defenderModuleIds: string[]) => {
      const runner = gunnerDuel(defenderModuleIds);
      const events = runTicks(runner, 60, (tick) => tick === 0
        ? [{ type: 'activatePrimaryAttack', entityId: 0, targetId: 1, direction: { x: 1, y: 0 } }, stopDefender()]
        : [stopDefender()]);
      const damage = events.find((event) => event.type === 'damage' && event.sourceId === 0 && event.targetId === 1);
      return damage?.type === 'damage' ? damage.amount : undefined;
    };

    const standard = firstPrimaryDamage([]);
    const plated = firstPrimaryDamage(['deflector-plate']);
    expect(standard).toBeDefined();
    expect(plated).toBeCloseTo((standard ?? 0) * 0.9, 5);
  });

  it('upgrades skill-projectile damage through the shoulder pod', () => {
    const firstSuppressiveHit = (attackerModuleIds: string[]) => {
      const runner = gunnerDuel([], attackerModuleIds);
      const events = runTicks(runner, 70, (tick) => tick === 0
        ? [{ type: 'activateAbility', entityId: 0, slot: 'skill2', targetId: 1, direction: { x: 1, y: 0 } }, stopDefender()]
        : [stopDefender()]);
      const hit = events.find((event) => event.type === 'weaponHit' && event.weaponId === 'suppressive-round');
      return hit?.type === 'weaponHit' ? hit.damage : undefined;
    };

    const standard = firstSuppressiveHit([]);
    const upgraded = firstSuppressiveHit(['shoulder-missile-pod']);
    expect(standard).toBeDefined();
    expect(upgraded).toBeCloseTo((standard ?? 0) * 1.12, 5);
  });
});
