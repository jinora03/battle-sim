import type {
  BattleDefinition,
  ControllerKind,
  EntityId,
  SimulationEvent,
  TeamId,
  WorldSnapshot
} from '@kinetic/protocol';

export interface FighterStats {
  damageDealt: number;
  damageTaken: number;
  kills: number;
  wallHits: number;
  maxImpact: number;
  abilitiesUsed: number;
  blasts: number;
  obstaclesDestroyed: number;
  hazardHits: number;
}

export function emptyFighterStats(): FighterStats {
  return {
    damageDealt: 0,
    damageTaken: 0,
    kills: 0,
    wallHits: 0,
    maxImpact: 0,
    abilitiesUsed: 0,
    blasts: 0,
    obstaclesDestroyed: 0,
    hazardHits: 0
  };
}

export function aggregateFighterStats(stats: Record<number, FighterStats>): FighterStats {
  return Object.values(stats).reduce((total, item) => ({
    damageDealt: total.damageDealt + item.damageDealt,
    damageTaken: total.damageTaken + item.damageTaken,
    kills: total.kills + item.kills,
    wallHits: total.wallHits + item.wallHits,
    maxImpact: Math.max(total.maxImpact, item.maxImpact),
    abilitiesUsed: total.abilitiesUsed + item.abilitiesUsed,
    blasts: total.blasts + item.blasts,
    obstaclesDestroyed: total.obstaclesDestroyed + item.obstaclesDestroyed,
    hazardHits: total.hazardHits + item.hazardHits
  }), emptyFighterStats());
}

export class BattleStatsTracker {
  private readonly stats = new Map<EntityId, FighterStats>();

  consume(events: readonly SimulationEvent[]): void {
    for (const event of events) {
      if (event.type === 'damage') {
        this.get(event.targetId).damageTaken += event.amount;
        if (event.sourceId !== undefined) this.get(event.sourceId).damageDealt += event.amount;
      } else if (event.type === 'death' && event.killerId !== undefined) {
        this.get(event.killerId).kills += 1;
      } else if (event.type === 'wallImpact') {
        this.get(event.entityId).wallHits += 1;
      } else if (event.type === 'impact') {
        this.get(event.a).maxImpact = Math.max(this.get(event.a).maxImpact, event.magnitude);
        this.get(event.b).maxImpact = Math.max(this.get(event.b).maxImpact, event.magnitude);
      } else if (event.type === 'abilityActivated') {
        this.get(event.entityId).abilitiesUsed += 1;
      } else if (event.type === 'blast') {
        this.get(event.sourceId).blasts += 1;
      } else if (event.type === 'obstacleDestroyed') {
        this.get(event.sourceId).obstaclesDestroyed += 1;
      } else if (event.type === 'hazardTriggered') {
        this.get(event.entityId).hazardHits += 1;
      }
    }
  }

  snapshot(): Record<number, FighterStats> {
    return Object.fromEntries([...this.stats.entries()].map(([id, stats]) => [id, { ...stats }]));
  }

  reset(): void {
    this.stats.clear();
  }

  private get(id: EntityId): FighterStats {
    let current = this.stats.get(id);
    if (!current) {
      current = emptyFighterStats();
      this.stats.set(id, current);
    }
    return current;
  }
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  xp: number;
  unlockFighterId?: string;
  check(snapshot: WorldSnapshot, stats: Record<number, FighterStats>, events: readonly SimulationEvent[]): boolean;
}

export interface AchievementUnlock {
  id: string;
  name: string;
  description: string;
  xp: number;
  unlockFighterId?: string;
}

const defaultRules: AchievementDefinition[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Witness the first knockout in a battle.',
    xp: 80,
    unlockFighterId: 'pyro-brawler',
    check: (_snapshot, _stats, events) => events.some((event) => event.type === 'death')
  },
  {
    id: 'pinball',
    name: 'Pinball',
    description: 'A fighter records at least 8 wall impacts in one battle.',
    xp: 100,
    unlockFighterId: 'volt-striker',
    check: (_snapshot, stats) => Object.values(stats).some((item) => item.wallHits >= 8)
  },
  {
    id: 'demolition-demo',
    name: 'Demolition Demo',
    description: 'A fighter triggers at least 4 radial blasts in one battle.',
    xp: 120,
    check: (_snapshot, stats) => Object.values(stats).some((item) => item.blasts >= 4)
  },
  {
    id: 'wrecking-ball',
    name: 'Wrecking Ball',
    description: 'Destroy a breakable arena object.',
    xp: 150,
    unlockFighterId: 'mech-bruiser',
    check: (_snapshot, stats) => Object.values(stats).some((item) => item.obstaclesDestroyed >= 1)
  },
  {
    id: 'skill-storm',
    name: 'Skill Storm',
    description: 'A fighter activates at least 12 skills in one battle.',
    xp: 140,
    unlockFighterId: 'void-reaper',
    check: (_snapshot, stats) => Object.values(stats).some((item) => item.abilitiesUsed >= 12)
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Finish a battle with a surviving fighter that took no damage.',
    xp: 180,
    unlockFighterId: 'thorn-colossus',
    check: (snapshot, stats, events) => events.some((event) => event.type === 'battleEnded')
      && snapshot.entities.some((entity) => entity.alive && (stats[entity.id]?.damageTaken ?? 0) === 0)
  },
  {
    id: 'hazard-course',
    name: 'Hazard Course',
    description: 'Survive at least 4 environmental hazard triggers in one battle.',
    xp: 100,
    unlockFighterId: 'frost-warden',
    check: (_snapshot, stats) => Object.values(stats).some((item) => item.hazardHits >= 4)
  }
];

export function listAchievementDefinitions(): AchievementDefinition[] {
  return defaultRules.map((rule) => ({ ...rule }));
}

export class AchievementEngine {
  private readonly unlocked = new Set<string>();

  constructor(
    private readonly rules: AchievementDefinition[] = defaultRules,
    initiallyUnlocked: readonly string[] = []
  ) {
    for (const id of initiallyUnlocked) this.unlocked.add(id);
  }

  consume(snapshot: WorldSnapshot, stats: Record<number, FighterStats>, events: readonly SimulationEvent[]): AchievementUnlock[] {
    const newlyUnlocked: AchievementUnlock[] = [];
    for (const rule of this.rules) {
      if (this.unlocked.has(rule.id)) continue;
      if (!rule.check(snapshot, stats, events)) continue;
      this.unlocked.add(rule.id);
      newlyUnlocked.push({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        xp: rule.xp,
        ...(rule.unlockFighterId ? { unlockFighterId: rule.unlockFighterId } : {})
      });
    }
    return newlyUnlocked;
  }

  listUnlocked(): AchievementDefinition[] {
    return this.rules.filter((rule) => this.unlocked.has(rule.id)).map((rule) => ({ ...rule }));
  }

  listUnlockedIds(): string[] {
    return this.rules.filter((rule) => this.unlocked.has(rule.id)).map((rule) => rule.id);
  }

  replaceUnlocked(ids: readonly string[]): void {
    this.unlocked.clear();
    for (const id of ids) this.unlocked.add(id);
  }

  /** Clears persistent achievement state. Battle restarts should not call this. */
  reset(): void {
    this.unlocked.clear();
  }
}

export type DifficultyId = 'relaxed' | 'standard' | 'intense';

export interface DifficultyPreset {
  id: DifficultyId;
  name: string;
  description: string;
  enemyHpScale: number;
  enemyDamageScale: number;
  enemySpeedScale: number;
  xpScale: number;
}

const DIFFICULTIES: Record<DifficultyId, DifficultyPreset> = {
  relaxed: {
    id: 'relaxed',
    name: 'Relaxed',
    description: 'Softer AI opponents for learning controls and abilities.',
    enemyHpScale: 0.72,
    enemyDamageScale: 0.76,
    enemySpeedScale: 0.9,
    xpScale: 0.75
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'The intended baseline balance.',
    enemyHpScale: 1,
    enemyDamageScale: 1,
    enemySpeedScale: 1,
    xpScale: 1
  },
  intense: {
    id: 'intense',
    name: 'Intense',
    description: 'Stronger and faster AI opponents with a modest XP bonus.',
    enemyHpScale: 1.34,
    enemyDamageScale: 1.28,
    enemySpeedScale: 1.12,
    xpScale: 1.35
  }
};

export function getDifficultyPreset(id: DifficultyId): DifficultyPreset {
  return { ...DIFFICULTIES[id] };
}

export function listDifficultyPresets(): DifficultyPreset[] {
  return Object.values(DIFFICULTIES).map((item) => ({ ...item }));
}

export interface SavedBattlePreset {
  id: string;
  name: string;
  fighterAId: string;
  fighterBId: string;
  controllerA: ControllerKind;
  controllerB: ControllerKind;
  arenaId: string;
  modeId: string;
  teamSizeA: number;
  teamSizeB: number;
  friendlyFire: boolean;
  teamCollision: 'full' | 'soft' | 'ghost';
  difficulty: DifficultyId;
  createdAt: number;
}

export interface MatchRecord {
  id: string;
  playedAt: number;
  seed: number;
  arenaId: string;
  modeId: string;
  durationTicks: number;
  winningTeam: TeamId | null;
  playerTeam: TeamId | null;
  outcome: 'win' | 'loss' | 'draw' | 'spectated';
  difficulty: DifficultyId;
  participants: Array<{ fighterId: string; team: TeamId; controller: ControllerKind }>;
  totals: FighterStats;
  xpEarned: number;
}

export interface BattleCompletionSummary {
  battle: BattleDefinition;
  durationTicks: number;
  winningTeam: TeamId | null;
  playerTeam: TeamId | null;
  stats: Record<number, FighterStats>;
  difficulty: DifficultyId;
}

export interface ProfileTotals {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  spectated: number;
  totalTicks: number;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  abilitiesUsed: number;
  blasts: number;
  obstaclesDestroyed: number;
  hazardHits: number;
}

export interface ProfileBests {
  damageDealt: number;
  kills: number;
  maxImpact: number;
  fastestWinTicks: number | null;
}

export interface ChallengeDefinition {
  id: string;
  name: string;
  description: string;
  target: number;
  xp: number;
  metric(profile: PlayerProfile): number;
}

const CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'battle-tested',
    name: 'Battle Tested',
    description: 'Complete 3 battles.',
    target: 3,
    xp: 160,
    metric: (profile) => profile.totals.battles
  },
  {
    id: 'victor-path',
    name: 'Victor Path',
    description: 'Win 2 player-controlled battles.',
    target: 2,
    xp: 220,
    metric: (profile) => profile.totals.wins
  },
  {
    id: 'ability-practice',
    name: 'Ability Practice',
    description: 'Activate 50 skills across battles.',
    target: 50,
    xp: 180,
    metric: (profile) => profile.totals.abilitiesUsed
  },
  {
    id: 'arena-tour',
    name: 'Arena Tour',
    description: 'Fight in 3 different arenas.',
    target: 3,
    xp: 180,
    metric: (profile) => profile.arenaIdsPlayed.length
  },
  {
    id: 'demolition-contract',
    name: 'Demolition Contract',
    description: 'Destroy 2 arena objects.',
    target: 2,
    xp: 200,
    metric: (profile) => profile.totals.obstaclesDestroyed
  },
  {
    id: 'world-tour',
    name: 'World Tour',
    description: 'Fight in all 6 release arenas.',
    target: 6,
    xp: 320,
    metric: (profile) => profile.arenaIdsPlayed.length
  },
  {
    id: 'mode-master',
    name: 'Mode Master',
    description: 'Complete battles in 5 different game modes.',
    target: 5,
    xp: 360,
    metric: (profile) => profile.modeIdsPlayed.length
  },
  {
    id: 'century-of-skills',
    name: 'Century of Skills',
    description: 'Activate 100 skills across battles.',
    target: 100,
    xp: 300,
    metric: (profile) => profile.totals.abilitiesUsed
  }
];

export function listChallengeDefinitions(): ChallengeDefinition[] {
  return CHALLENGES.map((item) => ({ ...item }));
}

export const PLAYER_PROFILE_SCHEMA_VERSION = 2 as const;

export interface PlayerProfile {
  schemaVersion: typeof PLAYER_PROFILE_SCHEMA_VERSION;
  playerId: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
  xp: number;
  level: number;
  difficulty: DifficultyId;
  unlockedFighterIds: string[];
  unlockedAchievementIds: string[];
  claimedChallengeIds: string[];
  arenaIdsPlayed: string[];
  modeIdsPlayed: string[];
  totals: ProfileTotals;
  bests: ProfileBests;
  matchHistory: MatchRecord[];
  loadouts: SavedBattlePreset[];
  selectedLoadoutId: string | null;
}

function createTotals(): ProfileTotals {
  return {
    battles: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    spectated: 0,
    totalTicks: 0,
    damageDealt: 0,
    damageTaken: 0,
    kills: 0,
    abilitiesUsed: 0,
    blasts: 0,
    obstaclesDestroyed: 0,
    hazardHits: 0
  };
}

function createBests(): ProfileBests {
  return { damageDealt: 0, kills: 0, maxImpact: 0, fastestWinTicks: null };
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 180)) + 1);
}

export function xpForLevel(level: number): number {
  const normalized = Math.max(1, Math.floor(level));
  return (normalized - 1) * (normalized - 1) * 180;
}

export function xpToNextLevel(profile: Pick<PlayerProfile, 'xp' | 'level'>): { current: number; required: number; progress: number } {
  const start = xpForLevel(profile.level);
  const end = xpForLevel(profile.level + 1);
  const current = Math.max(0, profile.xp - start);
  const required = Math.max(1, end - start);
  return { current, required, progress: Math.max(0, Math.min(1, current / required)) };
}

export function createDefaultPlayerProfile(now = Date.now()): PlayerProfile {
  return {
    schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
    playerId: `pilot-${Math.floor(now).toString(36)}`,
    displayName: 'Arena Pilot',
    createdAt: now,
    updatedAt: now,
    xp: 0,
    level: 1,
    difficulty: 'standard',
    unlockedFighterIds: ['water-shaper', 'bomber', 'gunner', 'rocket-vanguard'],
    unlockedAchievementIds: [],
    claimedChallengeIds: [],
    arenaIdsPlayed: [],
    modeIdsPlayed: [],
    totals: createTotals(),
    bests: createBests(),
    matchHistory: [],
    loadouts: [],
    selectedLoadoutId: null
  };
}

function uniqueStrings(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return [...fallback];
  return [...new Set(values.filter((item): item is string => typeof item === 'string' && item.length > 0))];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeMatchRecord(input: unknown): MatchRecord | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<MatchRecord>;
  if (typeof raw.id !== 'string' || typeof raw.arenaId !== 'string' || typeof raw.modeId !== 'string') return null;
  const outcome: MatchRecord['outcome'] = raw.outcome === 'win' || raw.outcome === 'loss' || raw.outcome === 'draw' || raw.outcome === 'spectated' ? raw.outcome : 'spectated';
  const difficulty: DifficultyId = raw.difficulty === 'relaxed' || raw.difficulty === 'intense' ? raw.difficulty : 'standard';
  const participants = Array.isArray(raw.participants) ? raw.participants.flatMap((participant) => {
    if (!participant || typeof participant !== 'object') return [];
    const item = participant as { fighterId?: unknown; team?: unknown; controller?: unknown };
    if (typeof item.fighterId !== 'string' || typeof item.team !== 'number') return [];
    const controller: ControllerKind = item.controller === 'player' || item.controller === 'replay' || item.controller === 'network' ? item.controller : 'ai';
    return [{ fighterId: item.fighterId, team: item.team, controller }];
  }) : [];
  const totalsRaw = raw.totals && typeof raw.totals === 'object' ? raw.totals as Partial<FighterStats> : {};
  return {
    id: raw.id,
    playedAt: numberOr(raw.playedAt, Date.now()),
    seed: numberOr(raw.seed, 1) >>> 0,
    arenaId: raw.arenaId,
    modeId: raw.modeId,
    durationTicks: Math.max(0, numberOr(raw.durationTicks, 0)),
    winningTeam: typeof raw.winningTeam === 'number' ? raw.winningTeam : null,
    playerTeam: typeof raw.playerTeam === 'number' ? raw.playerTeam : null,
    outcome,
    difficulty,
    participants,
    totals: {
      damageDealt: Math.max(0, numberOr(totalsRaw.damageDealt, 0)),
      damageTaken: Math.max(0, numberOr(totalsRaw.damageTaken, 0)),
      kills: Math.max(0, numberOr(totalsRaw.kills, 0)),
      wallHits: Math.max(0, numberOr(totalsRaw.wallHits, 0)),
      maxImpact: Math.max(0, numberOr(totalsRaw.maxImpact, 0)),
      abilitiesUsed: Math.max(0, numberOr(totalsRaw.abilitiesUsed, 0)),
      blasts: Math.max(0, numberOr(totalsRaw.blasts, 0)),
      obstaclesDestroyed: Math.max(0, numberOr(totalsRaw.obstaclesDestroyed, 0)),
      hazardHits: Math.max(0, numberOr(totalsRaw.hazardHits, 0))
    },
    xpEarned: Math.max(0, numberOr(raw.xpEarned, 0))
  };
}

function sanitizeBattlePreset(input: unknown): SavedBattlePreset | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<SavedBattlePreset>;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string' || typeof raw.fighterAId !== 'string' || typeof raw.fighterBId !== 'string' || typeof raw.arenaId !== 'string' || typeof raw.modeId !== 'string') return null;
  const controllerA: ControllerKind = raw.controllerA === 'ai' || raw.controllerA === 'replay' || raw.controllerA === 'network' ? raw.controllerA : 'player';
  const controllerB: ControllerKind = raw.controllerB === 'player' || raw.controllerB === 'replay' || raw.controllerB === 'network' ? raw.controllerB : 'ai';
  const teamCollision = raw.teamCollision === 'soft' || raw.teamCollision === 'ghost' ? raw.teamCollision : 'full';
  const difficulty: DifficultyId = raw.difficulty === 'relaxed' || raw.difficulty === 'intense' ? raw.difficulty : 'standard';
  return {
    id: raw.id,
    name: raw.name.slice(0, 32),
    fighterAId: raw.fighterAId,
    fighterBId: raw.fighterBId,
    controllerA,
    controllerB,
    arenaId: raw.arenaId,
    modeId: raw.modeId,
    teamSizeA: Math.max(1, Math.min(50, numberOr(raw.teamSizeA, 1))),
    teamSizeB: Math.max(1, Math.min(50, numberOr(raw.teamSizeB, 1))),
    friendlyFire: raw.friendlyFire === true,
    teamCollision,
    difficulty,
    createdAt: numberOr(raw.createdAt, Date.now())
  };
}

/** Accepts current saves and best-effort migrates older or partially damaged profile objects. */
export function migratePlayerProfile(input: unknown, now = Date.now()): PlayerProfile {
  const base = createDefaultPlayerProfile(now);
  if (!input || typeof input !== 'object') return base;
  const raw = input as Partial<PlayerProfile> & Record<string, unknown>;
  const totalsRaw = raw.totals && typeof raw.totals === 'object' ? raw.totals as Partial<ProfileTotals> : {};
  const bestsRaw = raw.bests && typeof raw.bests === 'object' ? raw.bests as Partial<ProfileBests> : {};
  const difficulty: DifficultyId = raw.difficulty === 'relaxed' || raw.difficulty === 'intense' ? raw.difficulty : 'standard';
  const xp = Math.max(0, numberOr(raw.xp, 0));
  return {
    ...base,
    playerId: typeof raw.playerId === 'string' && raw.playerId ? raw.playerId : base.playerId,
    displayName: typeof raw.displayName === 'string' && raw.displayName ? raw.displayName.slice(0, 40) : base.displayName,
    createdAt: numberOr(raw.createdAt, base.createdAt),
    updatedAt: numberOr(raw.updatedAt, now),
    xp,
    level: levelForXp(xp),
    difficulty,
    unlockedFighterIds: [...new Set([...base.unlockedFighterIds, ...uniqueStrings(raw.unlockedFighterIds, [])])],
    unlockedAchievementIds: uniqueStrings(raw.unlockedAchievementIds),
    claimedChallengeIds: uniqueStrings(raw.claimedChallengeIds),
    arenaIdsPlayed: uniqueStrings(raw.arenaIdsPlayed),
    modeIdsPlayed: uniqueStrings(raw.modeIdsPlayed),
    totals: {
      battles: Math.max(0, numberOr(totalsRaw.battles, 0)),
      wins: Math.max(0, numberOr(totalsRaw.wins, 0)),
      losses: Math.max(0, numberOr(totalsRaw.losses, 0)),
      draws: Math.max(0, numberOr(totalsRaw.draws, 0)),
      spectated: Math.max(0, numberOr(totalsRaw.spectated, 0)),
      totalTicks: Math.max(0, numberOr(totalsRaw.totalTicks, 0)),
      damageDealt: Math.max(0, numberOr(totalsRaw.damageDealt, 0)),
      damageTaken: Math.max(0, numberOr(totalsRaw.damageTaken, 0)),
      kills: Math.max(0, numberOr(totalsRaw.kills, 0)),
      abilitiesUsed: Math.max(0, numberOr(totalsRaw.abilitiesUsed, 0)),
      blasts: Math.max(0, numberOr(totalsRaw.blasts, 0)),
      obstaclesDestroyed: Math.max(0, numberOr(totalsRaw.obstaclesDestroyed, 0)),
      hazardHits: Math.max(0, numberOr(totalsRaw.hazardHits, 0))
    },
    bests: {
      damageDealt: Math.max(0, numberOr(bestsRaw.damageDealt, 0)),
      kills: Math.max(0, numberOr(bestsRaw.kills, 0)),
      maxImpact: Math.max(0, numberOr(bestsRaw.maxImpact, 0)),
      fastestWinTicks: typeof bestsRaw.fastestWinTicks === 'number' && bestsRaw.fastestWinTicks > 0 ? bestsRaw.fastestWinTicks : null
    },
    matchHistory: Array.isArray(raw.matchHistory) ? raw.matchHistory.map(sanitizeMatchRecord).filter((item): item is MatchRecord => item !== null).slice(0, 30) : [],
    loadouts: Array.isArray(raw.loadouts) ? raw.loadouts.map(sanitizeBattlePreset).filter((item): item is SavedBattlePreset => item !== null).slice(0, 12) : [],
    selectedLoadoutId: typeof raw.selectedLoadoutId === 'string' ? raw.selectedLoadoutId : null
  };
}

export function serializePlayerProfile(profile: PlayerProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function parsePlayerProfile(json: string): PlayerProfile {
  return migratePlayerProfile(JSON.parse(json) as unknown);
}

export interface ProgressionNotice {
  kind: 'achievement' | 'fighter' | 'challenge' | 'level' | 'battle';
  title: string;
  description: string;
}

export interface ProgressionUpdate {
  profile: PlayerProfile;
  notices: ProgressionNotice[];
  xpGained: number;
}

function addUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}

export function applyAchievementToProfile(profile: PlayerProfile, unlock: AchievementUnlock, now = Date.now()): ProgressionUpdate {
  if (profile.unlockedAchievementIds.includes(unlock.id)) return { profile, notices: [], xpGained: 0 };
  let unlockedFighterIds = [...profile.unlockedFighterIds];
  const notices: ProgressionNotice[] = [{
    kind: 'achievement',
    title: unlock.name,
    description: `${unlock.description} +${unlock.xp} XP`
  }];
  if (unlock.unlockFighterId && !unlockedFighterIds.includes(unlock.unlockFighterId)) {
    unlockedFighterIds = [...unlockedFighterIds, unlock.unlockFighterId];
    notices.push({ kind: 'fighter', title: 'Fighter unlocked', description: unlock.unlockFighterId.replaceAll('-', ' ') });
  }
  const xp = profile.xp + unlock.xp;
  const level = levelForXp(xp);
  if (level > profile.level) notices.push({ kind: 'level', title: `Level ${level}`, description: 'Profile level increased.' });
  return {
    profile: {
      ...profile,
      updatedAt: now,
      xp,
      level,
      unlockedAchievementIds: [...profile.unlockedAchievementIds, unlock.id],
      unlockedFighterIds
    },
    notices,
    xpGained: unlock.xp
  };
}

function playerOutcome(summary: BattleCompletionSummary): MatchRecord['outcome'] {
  if (summary.playerTeam === null) return 'spectated';
  if (summary.winningTeam === null) return 'draw';
  return summary.winningTeam === summary.playerTeam ? 'win' : 'loss';
}

function baseBattleXp(summary: BattleCompletionSummary, total: FighterStats): number {
  const outcome = playerOutcome(summary);
  const resultXp = outcome === 'win' ? 120 : outcome === 'loss' ? 60 : outcome === 'draw' ? 70 : 35;
  const activityXp = Math.min(180, Math.round(total.damageDealt / 30 + total.kills * 16 + total.abilitiesUsed * 1.5 + total.obstaclesDestroyed * 20));
  return Math.max(20, Math.round((resultXp + activityXp) * getDifficultyPreset(summary.difficulty).xpScale));
}

function challengeProgress(profile: PlayerProfile, challenge: ChallengeDefinition): number {
  return Math.min(challenge.target, Math.max(0, challenge.metric(profile)));
}

export function getChallengeProgress(profile: PlayerProfile): Array<ChallengeDefinition & { progress: number; complete: boolean; claimed: boolean }> {
  return CHALLENGES.map((challenge) => {
    const progress = challengeProgress(profile, challenge);
    return { ...challenge, progress, complete: progress >= challenge.target, claimed: profile.claimedChallengeIds.includes(challenge.id) };
  });
}

function awardCompletedChallenges(profile: PlayerProfile, notices: ProgressionNotice[]): { profile: PlayerProfile; xp: number } {
  let next = profile;
  let earned = 0;
  for (const challenge of CHALLENGES) {
    if (next.claimedChallengeIds.includes(challenge.id)) continue;
    if (challengeProgress(next, challenge) < challenge.target) continue;
    earned += challenge.xp;
    next = { ...next, claimedChallengeIds: [...next.claimedChallengeIds, challenge.id] };
    notices.push({ kind: 'challenge', title: challenge.name, description: `${challenge.description} +${challenge.xp} XP` });
  }
  return { profile: next, xp: earned };
}

export function recordBattleToProfile(profile: PlayerProfile, summary: BattleCompletionSummary, now = Date.now()): ProgressionUpdate {
  const total = aggregateFighterStats(summary.stats);
  const outcome = playerOutcome(summary);
  const battleXp = baseBattleXp(summary, total);
  const match: MatchRecord = {
    id: `match-${now.toString(36)}-${summary.battle.seed.toString(36)}`,
    playedAt: now,
    seed: summary.battle.seed,
    arenaId: summary.battle.arenaId,
    modeId: summary.battle.modeId,
    durationTicks: summary.durationTicks,
    winningTeam: summary.winningTeam,
    playerTeam: summary.playerTeam,
    outcome,
    difficulty: summary.difficulty,
    participants: summary.battle.participants.map((participant) => ({
      fighterId: participant.fighterId,
      team: participant.team,
      controller: participant.controller ?? 'ai'
    })),
    totals: total,
    xpEarned: battleXp
  };
  const totals: ProfileTotals = {
    battles: profile.totals.battles + 1,
    wins: profile.totals.wins + (outcome === 'win' ? 1 : 0),
    losses: profile.totals.losses + (outcome === 'loss' ? 1 : 0),
    draws: profile.totals.draws + (outcome === 'draw' ? 1 : 0),
    spectated: profile.totals.spectated + (outcome === 'spectated' ? 1 : 0),
    totalTicks: profile.totals.totalTicks + summary.durationTicks,
    damageDealt: profile.totals.damageDealt + total.damageDealt,
    damageTaken: profile.totals.damageTaken + total.damageTaken,
    kills: profile.totals.kills + total.kills,
    abilitiesUsed: profile.totals.abilitiesUsed + total.abilitiesUsed,
    blasts: profile.totals.blasts + total.blasts,
    obstaclesDestroyed: profile.totals.obstaclesDestroyed + total.obstaclesDestroyed,
    hazardHits: profile.totals.hazardHits + total.hazardHits
  };
  const bests: ProfileBests = {
    damageDealt: Math.max(profile.bests.damageDealt, total.damageDealt),
    kills: Math.max(profile.bests.kills, total.kills),
    maxImpact: Math.max(profile.bests.maxImpact, total.maxImpact),
    fastestWinTicks: outcome === 'win'
      ? profile.bests.fastestWinTicks === null ? summary.durationTicks : Math.min(profile.bests.fastestWinTicks, summary.durationTicks)
      : profile.bests.fastestWinTicks
  };
  const notices: ProgressionNotice[] = [{
    kind: 'battle',
    title: outcome === 'spectated' ? 'Simulation recorded' : outcome === 'win' ? 'Victory recorded' : outcome === 'loss' ? 'Defeat recorded' : 'Draw recorded',
    description: `+${battleXp} XP · ${Math.round(total.damageDealt)} damage · ${total.abilitiesUsed} skills`
  }];
  const battleLevel = levelForXp(profile.xp + battleXp);
  let next: PlayerProfile = {
    ...profile,
    updatedAt: now,
    xp: profile.xp + battleXp,
    level: battleLevel,
    totals,
    bests,
    arenaIdsPlayed: addUnique(profile.arenaIdsPlayed, summary.battle.arenaId),
    modeIdsPlayed: addUnique(profile.modeIdsPlayed, summary.battle.modeId),
    matchHistory: [match, ...profile.matchHistory].slice(0, 30)
  };
  if (battleLevel > profile.level) notices.push({ kind: 'level', title: `Level ${battleLevel}`, description: 'Profile level increased.' });
  const beforeChallengeLevel = next.level;
  const challengeAward = awardCompletedChallenges(next, notices);
  next = challengeAward.profile;
  const totalXp = battleXp + challengeAward.xp;
  if (challengeAward.xp > 0) {
    next = { ...next, xp: next.xp + challengeAward.xp, level: levelForXp(next.xp + challengeAward.xp) };
  }
  if (next.level > Math.max(profile.level, beforeChallengeLevel)) {
    notices.push({ kind: 'level', title: `Level ${next.level}`, description: 'Profile level increased.' });
  }
  return { profile: next, notices, xpGained: totalXp };
}

export function upsertBattlePreset(profile: PlayerProfile, preset: Omit<SavedBattlePreset, 'id' | 'createdAt'> & { id?: string; createdAt?: number }, now = Date.now()): PlayerProfile {
  const id = preset.id ?? `loadout-${now.toString(36)}`;
  const item: SavedBattlePreset = { ...preset, id, createdAt: preset.createdAt ?? now };
  return {
    ...profile,
    updatedAt: now,
    loadouts: [item, ...profile.loadouts.filter((current) => current.id !== id)].slice(0, 12),
    selectedLoadoutId: id
  };
}

export function removeBattlePreset(profile: PlayerProfile, id: string, now = Date.now()): PlayerProfile {
  return {
    ...profile,
    updatedAt: now,
    loadouts: profile.loadouts.filter((item) => item.id !== id),
    selectedLoadoutId: profile.selectedLoadoutId === id ? null : profile.selectedLoadoutId
  };
}

export function unlockAllFightersForTesting(profile: PlayerProfile, fighterIds: readonly string[], now = Date.now()): PlayerProfile {
  return {
    ...profile,
    updatedAt: now,
    unlockedFighterIds: [...new Set([...profile.unlockedFighterIds, ...fighterIds])]
  };
}
