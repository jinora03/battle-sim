export type EntityId = number;
export type TeamId = number;

export type Element =
  | 'neutral'
  | 'fire'
  | 'water'
  | 'ice'
  | 'electric'
  | 'metal'
  | 'nature'
  | 'void';

export type AbilitySlot = 'basic' | 'skill1' | 'skill2' | 'skill3' | 'ultimate';
export type ModuleSlot = 'offense' | 'defense' | 'mobility' | 'utility';
export type ControllerKind = 'ai' | 'player' | 'network' | 'replay';
export type TeamCollisionMode = 'full' | 'soft' | 'ghost';
export type AbilityPhase = 'ready' | 'casting' | 'armed' | 'cooldown';
export type RenderProfileId = 'standard' | 'minimal' | 'debug';
export type BlastKind = 'explosion' | 'wave';
export type PrimaryAttackBehavior =
  | 'melee'
  | 'spin'
  | 'ranged'
  | 'automatic'
  | 'throwable'
  | 'continuous'
  | 'beam'
  | 'orbit'
  | 'slam';
/** @deprecated Use PrimaryAttackBehavior. */
export type WeaponCategory = PrimaryAttackBehavior;
export type PrimaryAttackPhase = 'windup' | 'active' | 'recovery';
/** @deprecated Use PrimaryAttackPhase. */
export type WeaponAttackPhase = PrimaryAttackPhase;
export type ArenaZoneKind = 'ice' | 'water' | 'lava' | 'electric' | 'wind';
export type ArenaObstacleKind = 'pillar' | 'crate' | 'reactor';

export interface Vec2 {
  x: number;
  y: number;
}

export interface MoveCommand {
  type: 'move';
  entityId: EntityId;
  direction: Vec2;
  /** Independent look/weapon direction so orbiting fighters can face a target. */
  facing?: Vec2;
}

export interface ActivatePrimaryAttackCommand {
  type: 'activatePrimaryAttack';
  entityId: EntityId;
  targetId?: EntityId;
  direction?: Vec2;
}

export interface ActivateAbilityCommand {
  type: 'activateAbility';
  entityId: EntityId;
  /** Basic is retained in the public slot union for UI/replay migration, but new commands use activatePrimaryAttack. */
  slot: AbilitySlot;
  targetId?: EntityId;
  direction?: Vec2;
}

export interface StopCommand {
  type: 'stop';
  entityId: EntityId;
}

export type SimulationCommand = MoveCommand | ActivatePrimaryAttackCommand | ActivateAbilityCommand | StopCommand;

export interface SpawnEvent {
  type: 'spawn';
  tick: number;
  entityId: EntityId;
  fighterId: string;
  position: Vec2;
}

export interface ImpactEvent {
  type: 'impact';
  tick: number;
  a: EntityId;
  b: EntityId;
  position: Vec2;
  magnitude: number;
  relativeSpeed: number;
}

export interface WallImpactEvent {
  type: 'wallImpact';
  tick: number;
  entityId: EntityId;
  position: Vec2;
  magnitude: number;
}

export interface ObstacleImpactEvent {
  type: 'obstacleImpact';
  tick: number;
  entityId: EntityId;
  obstacleId: string;
  position: Vec2;
  magnitude: number;
}

export interface ObstacleDamagedEvent {
  type: 'obstacleDamaged';
  tick: number;
  sourceId: EntityId;
  obstacleId: string;
  amount: number;
  hpAfter: number;
  position: Vec2;
}

export interface ObstacleDestroyedEvent {
  type: 'obstacleDestroyed';
  tick: number;
  sourceId: EntityId;
  obstacleId: string;
  position: Vec2;
}

export interface ZoneEnteredEvent {
  type: 'zoneEntered';
  tick: number;
  entityId: EntityId;
  zoneId: string;
  kind: ArenaZoneKind;
  position: Vec2;
}

export interface ZoneExitedEvent {
  type: 'zoneExited';
  tick: number;
  entityId: EntityId;
  zoneId: string;
  kind: ArenaZoneKind;
  position: Vec2;
}

export interface HazardTriggeredEvent {
  type: 'hazardTriggered';
  tick: number;
  entityId: EntityId;
  zoneId: string;
  kind: ArenaZoneKind;
  position: Vec2;
  damage: number;
  force: number;
}

export interface BlastEvent {
  type: 'blast';
  tick: number;
  sourceId: EntityId;
  abilityId?: string;
  kind: BlastKind;
  position: Vec2;
  radius: number;
  force: number;
  damage: number;
  element: Element;
}


export interface WeaponAttackStartedEvent {
  type: 'weaponAttackStarted';
  tick: number;
  entityId: EntityId;
  weaponId: string;
  category: WeaponCategory;
  position: Vec2;
  direction: Vec2;
  windupTicks: number;
}

export interface WeaponHitEvent {
  type: 'weaponHit';
  tick: number;
  sourceId: EntityId;
  targetId: EntityId;
  weaponId: string;
  position: Vec2;
  damage: number;
  knockback: number;
}

export interface ProjectileSpawnedEvent {
  type: 'projectileSpawned';
  tick: number;
  projectileId: number;
  sourceId: EntityId;
  /** Primary-attack or skill-projectile identifier. */
  weaponId: string;
  position: Vec2;
  velocity: Vec2;
  targetId?: EntityId;
}

export interface ProjectileImpactEvent {
  type: 'projectileImpact';
  tick: number;
  projectileId: number;
  sourceId: EntityId;
  targetId?: EntityId;
  weaponId: string;
  position: Vec2;
}


export interface KnockbackAppliedEvent {
  type: 'knockbackApplied';
  tick: number;
  sourceId?: EntityId;
  targetId: EntityId;
  position: Vec2;
  direction: Vec2;
  force: number;
  kind: 'weapon' | 'explosion' | 'ability';
}

export interface DamageEvent {
  type: 'damage';
  tick: number;
  sourceId?: EntityId;
  targetId: EntityId;
  amount: number;
  element: Element;
  hpAfter: number;
  position?: Vec2;
  /** True when the training lab reports the real damage value without reducing HP. */
  prevented?: boolean;
}

export interface StatusAppliedEvent {
  type: 'statusApplied';
  tick: number;
  sourceId?: EntityId;
  targetId: EntityId;
  statusId: string;
  durationTicks: number;
  stacks: number;
}

export interface PassiveTriggeredEvent {
  type: 'passiveTriggered';
  tick: number;
  entityId: EntityId;
  passiveId: string;
  targetId?: EntityId;
}

/** Emitted when a fighter visibly commits to a skill. */
export interface AbilityActivatedEvent {
  type: 'abilityActivated';
  tick: number;
  entityId: EntityId;
  abilityId: string;
  slot: AbilitySlot;
  position: Vec2;
  direction: Vec2;
  castTicks: number;
}

/** Emitted when the skill's gameplay actions resolve. */
export interface AbilityResolvedEvent {
  type: 'abilityResolved';
  tick: number;
  entityId: EntityId;
  abilityId: string;
  slot: AbilitySlot;
  position: Vec2;
  direction: Vec2;
}

export interface DeathEvent {
  type: 'death';
  tick: number;
  entityId: EntityId;
  killerId?: EntityId;
  position: Vec2;
}

export type BattleEndReason = 'elimination' | 'boss-defeated' | 'survival-complete' | 'timeout' | 'draw';

export interface BattleResultSnapshot {
  reason: BattleEndReason;
  winningTeam: TeamId | null;
  winnerEntityIds: EntityId[];
  endedAtTick: number;
}

export interface BattleEndedEvent {
  type: 'battleEnded';
  tick: number;
  winningTeam: TeamId | null;
  reason: BattleEndReason;
  winnerEntityIds: EntityId[];
}

export type SimulationEvent =
  | SpawnEvent
  | ImpactEvent
  | WallImpactEvent
  | ObstacleImpactEvent
  | ObstacleDamagedEvent
  | ObstacleDestroyedEvent
  | ZoneEnteredEvent
  | ZoneExitedEvent
  | HazardTriggeredEvent
  | BlastEvent
  | WeaponAttackStartedEvent
  | WeaponHitEvent
  | ProjectileSpawnedEvent
  | ProjectileImpactEvent
  | KnockbackAppliedEvent
  | DamageEvent
  | StatusAppliedEvent
  | PassiveTriggeredEvent
  | AbilityActivatedEvent
  | AbilityResolvedEvent
  | DeathEvent
  | BattleEndedEvent;

export interface AbilityStateSnapshot {
  slot: AbilitySlot;
  /** Primary attacks occupy the Basic UI slot without pretending to be a normal ability. */
  source: 'primaryAttack' | 'ability';
  abilityId: string;
  phase: AbilityPhase;
  cooldownRemainingTicks: number;
  cooldownTotalTicks: number;
  castRemainingTicks: number;
  castTotalTicks: number;
  castDirection: Vec2 | null;
  armedRemainingTicks: number;
  armedTotalTicks: number;
}


export interface WeaponAttackStateSnapshot {
  weaponId: string;
  category: WeaponCategory;
  style: string;
  phase: WeaponAttackPhase;
  direction: Vec2;
  remainingTicks: number;
  totalTicks: number;
}

export interface StatusStateSnapshot {
  statusId: string;
  remainingTicks: number;
  /** Stack count for marks, burn and other status-driven combos. */
  stacks: number;
}

export interface CombatResourceStateSnapshot {
  resourceId: string;
  value: number;
  maximum: number;
}

export interface EntitySnapshot {
  id: EntityId;
  fighterId: string;
  team: TeamId;
  controller: ControllerKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  rotation: number;
  radius: number;
  mass: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  elements: Element[];
  traits: string[];
  abilities: AbilityStateSnapshot[];
  activeZoneIds: string[];
  statuses: StatusStateSnapshot[];
  /** Optional deterministic fighter resources such as Heat, Charge or Rage. */
  resources?: CombatResourceStateSnapshot[];
  /** Deterministically resolved developer-approved modules equipped for this battle. */
  moduleIds: string[];
  primaryAttackId: string;
  /** @deprecated Read primaryAttackId. */
  weaponId: string | null;
  weaponAttack: WeaponAttackStateSnapshot | null;
}

export interface ArenaObstacleSnapshot {
  id: string;
  kind: ArenaObstacleKind;
  shape: 'circle' | 'box';
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  destructible: boolean;
  alive: boolean;
}

export interface BattleObjectiveSnapshot {
  kind: 'elimination' | 'boss' | 'survival';
  label: string;
  progress: number;
  remainingTicks: number | null;
}

export interface SimulationMetricsSnapshot {
  activeEntities: number;
  commandsProcessed: number;
  candidatePairs: number;
  contactsResolved: number;
  sameTeamContacts: number;
  occupiedBroadphaseCells: number;
  maxBroadphaseBucket: number;
  projectileEntityChecks: number;
  projectileObstacleChecks: number;
  invalidNumericStates: number;
}


export interface ProjectileSnapshot {
  id: number;
  sourceId: EntityId;
  team: TeamId;
  weaponId: string;
  category: WeaponCategory;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  fuseRemainingTicks: number;
  arcHeight: number;
  rotation: number;
  targetId?: EntityId;
  trailStyle?: 'none' | 'smoke' | 'energy' | 'water' | 'spark';
}

export interface WorldSnapshot {
  tick: number;
  seed: number;
  arenaId: string;
  modeId: string;
  entities: EntitySnapshot[];
  obstacles: ArenaObstacleSnapshot[];
  projectiles: ProjectileSnapshot[];
  objective: BattleObjectiveSnapshot;
  battleEnded: boolean;
  winningTeam: TeamId | null;
  result: BattleResultSnapshot | null;
  metrics: SimulationMetricsSnapshot;
}

export interface ParticipantStatScale {
  hp?: number;
  radius?: number;
  mass?: number;
  damage?: number;
  speed?: number;
}

export interface FighterLoadout {
  moduleIds: string[];
}

export interface BattleParticipant {
  fighterId: string;
  team: TeamId;
  x?: number;
  y?: number;
  spawnZoneId?: string;
  controller?: ControllerKind;
  statScale?: ParticipantStatScale;
  loadout?: FighterLoadout;
}

export interface TrainingBattleRules {
  enabled?: boolean;
  damageEnabled?: boolean;
  cooldownsEnabled?: boolean;
  invulnerableTeams?: TeamId[];
  suppressVictory?: boolean;
}

export interface BattleRules {
  friendlyFire?: boolean;
  teamCollision?: TeamCollisionMode;
  teamCollisionScale?: number;
  /** @deprecated Ordinary body contact no longer deals damage. Retained only for old replay compatibility. */
  collisionDamageCooldownTicks?: number;
  maxBattleTicks?: number;
  /** Optional deterministic Ability Lab behavior. Normal battles leave this undefined. */
  training?: TrainingBattleRules;
}

export interface BattleDefinition {
  seed: number;
  arenaId: string;
  modeId: string;
  participants: BattleParticipant[];
  rules?: BattleRules;
}

export interface ReplayFrame {
  tick: number;
  commands: SimulationCommand[];
}

/** Lossless run-length encoding for identical per-tick movement commands. */
export interface ReplayMovementRun {
  startTick: number;
  endTick: number;
  command: MoveCommand;
}

export interface ReplayDataV1 {
  schemaVersion: 1;
  engineVersion: string;
  contentVersion: string;
  battle: BattleDefinition;
  frames: ReplayFrame[];
}

export interface ReplayDataV2 {
  schemaVersion: 2;
  engineVersion: string;
  contentVersion: string;
  battle: BattleDefinition;
  /** Non-repeating actions and any exceptional movement commands. */
  frames: ReplayFrame[];
  /** Identical movement commands repeated over an inclusive tick range. */
  movementRuns: ReplayMovementRun[];
}

export type ReplayData = ReplayDataV1 | ReplayDataV2;
