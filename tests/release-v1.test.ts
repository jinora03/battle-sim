import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import { getAbility, getPrimaryAttack, listArenas, listFighters, listGameModes } from '@kinetic/content';
import { listAchievementDefinitions } from '@kinetic/meta';
import type { BattleDefinition } from '@kinetic/protocol';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import { getMotionRecipe, getSkillPresentation, getVisualRecipe } from '@kinetic/visual-engine';

const releaseRosterIds = ['water-shaper', 'bomber', 'pyro-brawler', 'mech-bruiser', 'frost-warden', 'volt-striker', 'thorn-colossus', 'void-reaper'];

describe('v1.0 release content', () => {
  it('connects every release fighter to visuals, motion and five presented skills', () => {
    const roster = listFighters().filter((fighter) => releaseRosterIds.includes(fighter.id));
    expect(roster).toHaveLength(8);
    for (const fighter of roster) {
      expect(getVisualRecipe(fighter.visualRecipeId)).toBeDefined();
      expect(getMotionRecipe(fighter.animationRecipeId)).toBeDefined();
      expect(getPrimaryAttack(fighter.primaryAttackId).name.length).toBeGreaterThan(0);
      for (const slot of ['skill1', 'skill2', 'skill3', 'ultimate'] as const) {
        const abilityId = fighter.abilitySlots[slot];
        expect(abilityId).toBeTruthy();
        const ability = getAbility(abilityId!);
        expect(getSkillPresentation(ability.id).shortName.length).toBeGreaterThan(0);
      }
    }
  });

  it('ships the target arena and game-mode counts', () => {
    expect(listArenas()).toHaveLength(7);
    expect(listGameModes()).toHaveLength(7);
  });

  it('only references real fighters from achievement unlocks', () => {
    const fighterIds = new Set(listFighters().map((fighter) => fighter.id));
    for (const achievement of listAchievementDefinitions()) {
      if (achievement.unlockFighterId) expect(fighterIds.has(achievement.unlockFighterId)).toBe(true);
    }
  });

  it('repeats a mixed-roster team battle from the same seed', () => {
    const run = () => {
      const battle: BattleDefinition = {
        seed: 101010,
        arenaId: 'arc-crucible',
        modeId: 'team-battle',
        participants: [
          { fighterId: 'water-shaper', team: 1 },
          { fighterId: 'frost-warden', team: 1 },
          { fighterId: 'volt-striker', team: 1 },
          { fighterId: 'thorn-colossus', team: 1 },
          { fighterId: 'bomber', team: 2 },
          { fighterId: 'pyro-brawler', team: 2 },
          { fighterId: 'mech-bruiser', team: 2 },
          { fighterId: 'void-reaper', team: 2 }
        ],
        rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, collisionDamageCooldownTicks: 12, maxBattleTicks: 1200 }
      };
      const runner = new LocalSimulationRunner(battle);
      const ai = new AiController();
      for (let tick = 0; tick < 360 && !runner.getSnapshot().battleEnded; tick += 1) runner.step(ai.commandsForTick(runner.getSnapshot()));
      return checksumSnapshot(runner.getSnapshot());
    };
    expect(run()).toBe(run());
  });
});
