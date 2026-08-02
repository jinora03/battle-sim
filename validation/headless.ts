import { AiController, PlayerController } from '@kinetic/controllers';
import { LocalSimulationRunner, checksumSnapshot } from '@kinetic/simulation';
import type { BattleDefinition } from '@kinetic/protocol';

function run(seed:number) {
  const battle:BattleDefinition = {seed, arenaId:'iron-pit', modeId:'duel', participants:[
    {fighterId:'water-shaper',team:1,x:190,y:480}, {fighterId:'bomber',team:2,x:530,y:480}
  ]};
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  let starts=0,resolves=0,blasts=0,maxCasting=0;
  for(let i=0;i<2400 && !runner.getSnapshot().battleEnded;i++) {
    const before=runner.getSnapshot();
    maxCasting=Math.max(maxCasting,before.entities.filter(e=>e.abilities.some(a=>a.phase==='casting')).length);
    const events=runner.step(ai.commandsForTick(before));
    starts += events.filter(e=>e.type==='abilityActivated').length;
    resolves += events.filter(e=>e.type==='abilityResolved').length;
    blasts += events.filter(e=>e.type==='blast').length;
  }
  const final=runner.getSnapshot();
  return {tick:final.tick, checksum:checksumSnapshot(final), starts,resolves,blasts,maxCasting,winner:final.winningTeam};
}

function runPlayer(seed:number) {
  const battle:BattleDefinition = {seed, arenaId:'iron-pit', modeId:'duel', participants:[
    {fighterId:'water-shaper',team:1,x:190,y:480,controller:'player'},
    {fighterId:'bomber',team:2,x:530,y:480,controller:'ai'}
  ]};
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  const player = new PlayerController();
  player.setControlledEntities([0]);
  player.setMovement({x:1,y:0});
  player.setAim({x:1,y:0});
  let playerStarts=0;
  let aiControlledPlayer=false;
  for(let i=0;i<420 && !runner.getSnapshot().battleEnded;i++) {
    const before=runner.getSnapshot();
    if(i===20 || i===180) player.activate('skill1');
    if(i===100) player.activate('skill2');
    const aiCommands=ai.commandsForTick(before);
    aiControlledPlayer ||= aiCommands.some(command=>command.entityId===0);
    const events=runner.step([...aiCommands,...player.commandsForTick(before)]);
    playerStarts += events.filter(event=>event.type==='abilityActivated' && event.entityId===0).length;
  }
  const final=runner.getSnapshot();
  const playerEntity=final.entities.find(entity=>entity.id===0);
  return {
    tick:final.tick,
    checksum:checksumSnapshot(final),
    playerStarts,
    aiControlledPlayer,
    playerController:playerEntity?.controller,
    playerX:Math.round(playerEntity?.x ?? 0)
  };
}

console.log(JSON.stringify(run(4812914)));
console.log(JSON.stringify(run(4812914)));
console.log(JSON.stringify(run(4812915)));
console.log(JSON.stringify(runPlayer(4812914)));
console.log(JSON.stringify(runPlayer(4812914)));

import { registerFighterBundle, type FighterBundle } from '@kinetic/creator';

function runCustom(seed:number) {
  const bundle:FighterBundle = {
    schemaVersion: 1,
    fighter: {
      id: 'headless-arc-prototype', name: 'Headless Arc Prototype',
      classification: { archetype: 'striker', elements: ['electric'], traits: ['custom','validation'] },
      physics: { radius: 45, mass: 1.25, restitution: 0.94, linearDamping: 0.993, maxSpeed: 12.2 },
      stats: { maxHp: 225, moveAcceleration: 0.2 },
      aiProfileId: 'aggressive-brawler',
      abilitySlots: { basic:'blast-contact', skill1:'surge-dash', skill2:'kinetic-pulse', skill3:'undertow', ultimate:'reactor-overdrive' },
      resistances: { electric: 0.75, metal: 0.9 },
      visualRecipeId: 'headless-arc-prototype-visual', animationRecipeId: 'headless-arc-prototype-motion', audioProfileId: 'custom-hybrid'
    },
    visualRecipe: { id:'headless-arc-prototype-visual', shape:'orb', bodyColor:0x6f58dd, bodyDarkColor:0x241b55, coreColor:0xfff26c, auraColor:0xb46cff, accentColor:0x66efff, weapon:'blade', horns:false },
    motionRecipe: { id:'headless-arc-prototype-motion', speedStretch:0.17, impactSquash:0.2, lean:0.14, pulseAmount:0.04, pulseSpeed:3.1, weaponSpin:2.2 }
  };
  registerFighterBundle(bundle, true);
  const battle:BattleDefinition = { seed, arenaId:'iron-pit', modeId:'duel', participants:[
    {fighterId:bundle.fighter.id,team:1,x:190,y:480}, {fighterId:'bomber',team:2,x:530,y:480}
  ]};
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  let starts=0;
  for(let i=0;i<900 && !runner.getSnapshot().battleEnded;i++) {
    const before=runner.getSnapshot();
    const events=runner.step(ai.commandsForTick(before));
    starts += events.filter(event=>event.type==='abilityActivated' && event.entityId===0).length;
  }
  const final=runner.getSnapshot();
  return { tick:final.tick, checksum:checksumSnapshot(final), starts, fighter:final.entities[0]?.fighterId, winner:final.winningTeam };
}

console.log(JSON.stringify(runCustom(88217)));
console.log(JSON.stringify(runCustom(88217)));

function runArenaScenario(battle: BattleDefinition, maxTicks = 3600) {
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  const counts = {
    zoneEntered: 0,
    hazardTriggered: 0,
    obstacleImpact: 0,
    obstacleDamaged: 0,
    obstacleDestroyed: 0
  };
  for (let index = 0; index < maxTicks && !runner.getSnapshot().battleEnded; index += 1) {
    const events = runner.step(ai.commandsForTick(runner.getSnapshot()));
    for (const event of events) {
      if (event.type === 'zoneEntered') counts.zoneEntered += 1;
      else if (event.type === 'hazardTriggered') counts.hazardTriggered += 1;
      else if (event.type === 'obstacleImpact') counts.obstacleImpact += 1;
      else if (event.type === 'obstacleDamaged') counts.obstacleDamaged += 1;
      else if (event.type === 'obstacleDestroyed') counts.obstacleDestroyed += 1;
    }
  }
  const snapshot = runner.getSnapshot();
  return {
    tick: snapshot.tick,
    checksum: checksumSnapshot(snapshot),
    winner: snapshot.winningTeam,
    objective: snapshot.objective,
    destroyedObstacles: snapshot.obstacles.filter((obstacle) => !obstacle.alive).map((obstacle) => obstacle.id),
    counts
  };
}

const phase06Foundry: BattleDefinition = {
  seed: 778811,
  arenaId: 'elemental-foundry',
  modeId: 'team-battle',
  participants: [
    { fighterId: 'water-shaper', team: 1 },
    { fighterId: 'water-shaper', team: 1 },
    { fighterId: 'pyro-brawler', team: 1 },
    { fighterId: 'bomber', team: 2 },
    { fighterId: 'bomber', team: 2 },
    { fighterId: 'mech-bruiser', team: 2 }
  ]
};

const phase06Boss: BattleDefinition = {
  seed: 9917,
  arenaId: 'pillar-court',
  modeId: 'boss-raid',
  participants: [
    { fighterId: 'water-shaper', team: 1 },
    { fighterId: 'pyro-brawler', team: 1 },
    {
      fighterId: 'bomber',
      team: 2,
      statScale: { hp: 4.5, radius: 1.65, mass: 3.2, damage: 1.65, speed: 0.86 }
    }
  ]
};

const phase06Survival: BattleDefinition = {
  seed: 5501,
  arenaId: 'elemental-foundry',
  modeId: 'survival',
  participants: [
    { fighterId: 'water-shaper', team: 1, statScale: { hp: 1.35 } },
    { fighterId: 'bomber', team: 2 },
    { fighterId: 'bomber', team: 2 },
    { fighterId: 'pyro-brawler', team: 2 },
    { fighterId: 'mech-bruiser', team: 2 }
  ]
};

console.log(JSON.stringify({ phase: '0.6-foundry', ...runArenaScenario(phase06Foundry, 3000) }));
console.log(JSON.stringify({ phase: '0.6-foundry-repeat', ...runArenaScenario(phase06Foundry, 3000) }));
console.log(JSON.stringify({ phase: '0.6-boss', ...runArenaScenario(phase06Boss, 3600) }));
console.log(JSON.stringify({ phase: '0.6-survival', ...runArenaScenario(phase06Survival, 3000) }));

function runScale(seed: number, ticks = 900) {
  const participants: BattleDefinition['participants'] = [];
  for (let index = 0; index < 20; index += 1) participants.push({ fighterId: index % 2 === 0 ? 'water-shaper' : 'pyro-brawler', team: 1 });
  for (let index = 0; index < 20; index += 1) participants.push({ fighterId: index % 2 === 0 ? 'bomber' : 'mech-bruiser', team: 2 });
  const battle: BattleDefinition = {
    seed,
    arenaId: 'war-basin',
    modeId: 'mass-skirmish',
    participants,
    rules: { friendlyFire: false, teamCollision: 'soft', teamCollisionScale: 0.24, collisionDamageCooldownTicks: 12, maxBattleTicks: 1800 }
  };
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController();
  let totalCandidates = 0;
  let maxCandidates = 0;
  let totalContacts = 0;
  let sameTeamContacts = 0;
  let abilityStarts = 0;
  for (let index = 0; index < ticks && !runner.getSnapshot().battleEnded; index += 1) {
    const events = runner.step(ai.commandsForTick(runner.getSnapshot()));
    const snapshot = runner.getSnapshot();
    totalCandidates += snapshot.metrics.candidatePairs;
    maxCandidates = Math.max(maxCandidates, snapshot.metrics.candidatePairs);
    totalContacts += snapshot.metrics.contactsResolved;
    sameTeamContacts += snapshot.metrics.sameTeamContacts;
    abilityStarts += events.filter((event) => event.type === 'abilityActivated').length;
  }
  const snapshot = runner.getSnapshot();
  const teams = [...new Set(snapshot.entities.map((entity) => entity.team))].map((team) => ({ team, alive: snapshot.entities.filter((entity) => entity.team === team).length }));
  return {
    phase: '0.7-mass-skirmish', seed, tick: snapshot.tick, checksum: checksumSnapshot(snapshot), winner: snapshot.winningTeam,
    alive: snapshot.entities.length, teams, totalCandidates, maxCandidates, totalContacts, sameTeamContacts, abilityStarts
  };
}

console.log(JSON.stringify(runScale(707070)));
console.log(JSON.stringify(runScale(707070)));
console.log(JSON.stringify(runScale(707071)));

import {
  applyAchievementToProfile,
  createDefaultPlayerProfile,
  getChallengeProgress,
  recordBattleToProfile,
  serializePlayerProfile,
  parsePlayerProfile,
  type BattleCompletionSummary,
  type FighterStats
} from '@kinetic/meta';

function validateProgression() {
  const stats: FighterStats = {
    damageDealt: 420, damageTaken: 80, kills: 1, wallHits: 3, maxImpact: 48,
    abilitiesUsed: 21, blasts: 4, obstaclesDestroyed: 1, hazardHits: 0
  };
  let profile = createDefaultPlayerProfile(1);
  const achievement = applyAchievementToProfile(profile, {
    id: 'first-blood', name: 'First Blood', description: 'Witness a knockout.', xp: 80, unlockFighterId: 'pyro-brawler'
  }, 2);
  profile = achievement.profile;
  for (let index = 0; index < 3; index += 1) {
    const battle: BattleDefinition = {
      seed: 8000 + index,
      arenaId: index % 2 === 0 ? 'pillar-court' : 'elemental-foundry',
      modeId: 'duel',
      participants: [
        { fighterId: 'water-shaper', team: 1, controller: 'player' },
        { fighterId: 'bomber', team: 2, controller: 'ai' }
      ]
    };
    const summary: BattleCompletionSummary = {
      battle, durationTicks: 900, winningTeam: 1, playerTeam: 1, stats: { 0: stats }, difficulty: index === 2 ? 'intense' : 'standard'
    };
    profile = recordBattleToProfile(profile, summary, 10 + index).profile;
  }
  const restored = parsePlayerProfile(serializePlayerProfile(profile));
  return {
    phase: '0.8-progression',
    level: restored.level,
    xp: restored.xp,
    battles: restored.totals.battles,
    wins: restored.totals.wins,
    achievements: restored.unlockedAchievementIds,
    fighters: restored.unlockedFighterIds,
    history: restored.matchHistory.length,
    challenges: getChallengeProgress(restored).filter((item) => item.claimed).map((item) => item.id)
  };
}

console.log(JSON.stringify(validateProgression()));
