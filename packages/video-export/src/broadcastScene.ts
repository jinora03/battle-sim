import { getAbility, getArena, getFighter, getGameMode, getPrimaryAttack, getStatus } from '@kinetic/content';
import { getVisualRecipe } from '@kinetic/visual-engine';
import type {
  AbilityStateSnapshot,
  BattleDefinition,
  EntityId,
  EntitySnapshot,
  SimulationEvent,
  StatusStateSnapshot,
  WorldSnapshot
} from '@kinetic/protocol';

const TICKS_PER_SECOND = 60;
const ABILITY_CALLOUT_TICKS = 150;
const EVENT_CALLOUT_TICKS = 105;
const MAJOR_DAMAGE_FLOOR = 90;

export interface BroadcastAbilityView {
  id: string;
  name: string;
  slot: AbilityStateSnapshot['slot'];
  phase: AbilityStateSnapshot['phase'];
  readiness: number;
}

export interface BroadcastStatusView {
  id: string;
  name: string;
  stacks: number;
}

export interface BroadcastResourceView {
  id: string;
  name: string;
  value: number;
  maximum: number;
  ratio: number;
}


export interface BroadcastFighterVisual {
  shape: 'orb' | 'mech' | 'water' | 'bomber';
  bodyColor: number;
  bodyDarkColor: number;
  coreColor: number;
  auraColor: number;
  accentColor: number;
  horns: boolean;
}

export interface BroadcastFighterView {
  entityId: EntityId | null;
  team: number;
  fighterId: string;
  name: string;
  identity: string;
  weaponName: string;
  visual: BroadcastFighterVisual;
  memberCount: number;
  hp: number;
  maxHp: number;
  hpRatio: number;
  alive: boolean;
  abilities: BroadcastAbilityView[];
  resource: BroadcastResourceView | null;
  statuses: BroadcastStatusView[];
}

export interface BroadcastCallout {
  eyebrow: string;
  title: string;
  detail: string | null;
}

export interface BroadcastScene {
  tick: number;
  timerLabel: string;
  modeName: string;
  roundLabel: string;
  objectiveLabel: string;
  arenaName: string;
  arenaTypeLabel: string;
  left: BroadcastFighterView;
  right: BroadcastFighterView;
  abilityCallout: BroadcastCallout | null;
  eventCallout: BroadcastCallout | null;
  resultCallout: BroadcastCallout | null;
}

interface TimedCallout {
  callout: BroadcastCallout;
  expiresAtTick: number;
}

export class BroadcastSceneTracker {
  private abilityCallout: TimedCallout | null = null;
  private eventCallout: TimedCallout | null = null;
  private readonly preferredTeams: number[];
  private readonly previousByTeam = new Map<number, BroadcastFighterView>();
  private readonly arenaName: string;
  private readonly arenaTypeLabel: string;

  constructor(private readonly battle: BattleDefinition) {
    this.preferredTeams = [...new Set(battle.participants.map((participant) => participant.team))].slice(0, 2);
    const arenaPresentation = resolveArenaPresentation(battle.arenaId);
    this.arenaName = arenaPresentation.name;
    this.arenaTypeLabel = arenaPresentation.typeLabel;
  }

  update(snapshot: WorldSnapshot, events: readonly SimulationEvent[]): BroadcastScene {
    const teams = this.resolveTeams(snapshot);
    const leftTeam = teams[0] ?? 1;
    const rightTeam = teams[1] ?? teams[0] ?? 2;
    const left = createTeamView(snapshot, this.battle, leftTeam, this.previousByTeam.get(leftTeam));
    const right = createTeamView(snapshot, this.battle, rightTeam, this.previousByTeam.get(rightTeam));
    this.previousByTeam.set(leftTeam, left);
    this.previousByTeam.set(rightTeam, right);
    const entityNames = new Map<EntityId, string>();
    for (const entity of snapshot.entities) entityNames.set(entity.id, resolveFighterName(entity.fighterId));

    for (const event of events) {
      if (event.type === 'abilityActivated') {
        const actor = entityNames.get(event.entityId) ?? 'Fighter';
        this.abilityCallout = {
          callout: {
            eyebrow: `${actor} activated`,
            title: resolveAbilityName(event.abilityId),
            detail: event.slot === 'ultimate' ? 'ULTIMATE' : null
          },
          expiresAtTick: snapshot.tick + Math.max(ABILITY_CALLOUT_TICKS, event.castTicks + 75)
        };
      } else if (event.type === 'damage' && !event.prevented && event.amount >= MAJOR_DAMAGE_FLOOR) {
        const source = event.sourceId === undefined ? 'Arena' : entityNames.get(event.sourceId) ?? 'Fighter';
        this.eventCallout = {
          callout: {
            eyebrow: 'Heavy impact',
            title: `${Math.round(event.amount).toLocaleString()} damage`,
            detail: source
          },
          expiresAtTick: snapshot.tick + EVENT_CALLOUT_TICKS
        };
      } else if (event.type === 'death') {
        this.eventCallout = {
          callout: {
            eyebrow: 'Knockout',
            title: entityNames.get(event.entityId) ?? 'Fighter down',
            detail: event.killerId === undefined ? null : `Defeated by ${entityNames.get(event.killerId) ?? 'opponent'}`
          },
          expiresAtTick: snapshot.tick + EVENT_CALLOUT_TICKS * 2
        };
      }
    }

    if (this.abilityCallout && snapshot.tick >= this.abilityCallout.expiresAtTick) this.abilityCallout = null;
    if (this.eventCallout && snapshot.tick >= this.eventCallout.expiresAtTick) this.eventCallout = null;

    return {
      tick: snapshot.tick,
      timerLabel: formatTimer(snapshot.tick),
      modeName: resolveModeName(snapshot.modeId),
      roundLabel: 'Round 1',
      objectiveLabel: snapshot.objective.label,
      arenaName: this.arenaName,
      arenaTypeLabel: this.arenaTypeLabel,
      left,
      right,
      abilityCallout: this.abilityCallout?.callout ?? null,
      eventCallout: this.eventCallout?.callout ?? null,
      resultCallout: createResultCallout(snapshot, left, right)
    };
  }

  private resolveTeams(snapshot: WorldSnapshot): number[] {
    const snapshotTeams = [...new Set(snapshot.entities.map((entity) => entity.team))];
    const ordered = [...this.preferredTeams];
    for (const team of snapshotTeams) if (!ordered.includes(team)) ordered.push(team);
    while (ordered.length < 2) ordered.push(ordered.length + 1);
    return ordered.slice(0, 2);
  }
}

function createTeamView(
  snapshot: WorldSnapshot,
  battle: BattleDefinition,
  team: number,
  previous?: BroadcastFighterView
): BroadcastFighterView {
  const members = snapshot.entities.filter((entity) => entity.team === team);
  const participant = battle.participants.find((item) => item.team === team);
  const primary = resolvePrimaryEntity(members, participant?.fighterId);
  const hp = members.reduce((sum, entity) => sum + Math.max(0, entity.hp), 0);
  const currentMaxHp = members.reduce((sum, entity) => sum + Math.max(0, entity.maxHp), 0);
  const maxHp = Math.max(currentMaxHp, previous?.maxHp ?? 0);
  const fighterId = primary?.fighterId ?? participant?.fighterId ?? previous?.fighterId ?? `team-${team}`;
  const memberCount = Math.max(
    members.length,
    battle.participants.filter((item) => item.team === team).length,
    previous?.memberCount ?? 0
  );
  const presentation = resolveFighterPresentation(fighterId);
  return {
    entityId: primary?.id ?? null,
    team,
    fighterId,
    name: memberCount > 1 ? `Team ${team}` : presentation.name,
    identity: memberCount > 1 ? `${memberCount} fighters` : presentation.identity,
    weaponName: memberCount > 1 ? 'Mixed loadout' : presentation.weaponName,
    visual: presentation.visual,
    memberCount,
    hp,
    maxHp,
    hpRatio: maxHp > 0 ? clamp01(hp / maxHp) : 0,
    alive: members.some((entity) => entity.alive),
    abilities: primary ? primary.abilities.map(createAbilityView).slice(0, 5) : previous?.abilities ?? [],
    resource: primary?.resources?.[0] ? createResourceView(primary.resources[0]) : previous?.resource ?? null,
    statuses: primary ? primary.statuses.slice(0, 3).map(createStatusView) : []
  };
}

function resolvePrimaryEntity(members: EntitySnapshot[], fighterId?: string): EntitySnapshot | undefined {
  return members.find((entity) => entity.fighterId === fighterId && entity.alive)
    ?? members.find((entity) => entity.alive)
    ?? members.find((entity) => entity.fighterId === fighterId)
    ?? members[0];
}

function createAbilityView(ability: AbilityStateSnapshot): BroadcastAbilityView {
  const readiness = ability.phase === 'ready'
    ? 1
    : ability.phase === 'cooldown' && ability.cooldownTotalTicks > 0
      ? clamp01(1 - ability.cooldownRemainingTicks / ability.cooldownTotalTicks)
      : ability.phase === 'casting' && ability.castTotalTicks > 0
        ? clamp01(1 - ability.castRemainingTicks / ability.castTotalTicks)
        : 0;
  return {
    id: ability.abilityId,
    name: ability.source === 'primaryAttack'
      ? resolvePrimaryAttackName(ability.abilityId)
      : resolveAbilityName(ability.abilityId),
    slot: ability.slot,
    phase: ability.phase,
    readiness
  };
}

function createResourceView(resource: NonNullable<EntitySnapshot['resources']>[number]): BroadcastResourceView {
  return {
    id: resource.resourceId,
    name: titleize(resource.resourceId),
    value: resource.value,
    maximum: resource.maximum,
    ratio: resource.maximum > 0 ? clamp01(resource.value / resource.maximum) : 0
  };
}

function createStatusView(status: StatusStateSnapshot): BroadcastStatusView {
  return {
    id: status.statusId,
    name: safeContentName(() => titleize(getStatus(status.statusId).id), status.statusId),
    stacks: status.stacks
  };
}

function createResultCallout(
  snapshot: WorldSnapshot,
  left: BroadcastFighterView,
  right: BroadcastFighterView
): BroadcastCallout | null {
  if (!snapshot.battleEnded) return null;
  if (snapshot.winningTeam === null) {
    return { eyebrow: 'Battle complete', title: 'Draw', detail: snapshot.result?.reason ?? null };
  }
  const winner = snapshot.winningTeam === left.team ? left : snapshot.winningTeam === right.team ? right : null;
  return {
    eyebrow: 'Winner',
    title: winner?.name ?? `Team ${snapshot.winningTeam}`,
    detail: snapshot.result?.reason ? titleize(snapshot.result.reason) : null
  };
}

function resolveFighterName(id: string): string {
  return resolveFighterPresentation(id).name;
}

function resolveFighterPresentation(id: string): { name: string; identity: string; weaponName: string; visual: BroadcastFighterVisual } {
  try {
    const fighter = getFighter(id);
    const visual = getVisualRecipe(fighter.visualRecipeId);
    return {
      name: fighter.name,
      identity: `${fighter.classification.elements.map(titleize).join(' / ')} · ${titleize(fighter.classification.archetype)}`,
      weaponName: resolvePrimaryAttackName(fighter.primaryAttackId),
      visual: {
        shape: visual.shape,
        bodyColor: visual.bodyColor,
        bodyDarkColor: visual.bodyDarkColor,
        coreColor: visual.coreColor,
        auraColor: visual.auraColor,
        accentColor: visual.accentColor,
        horns: visual.horns
      }
    };
  } catch {
    return {
      name: titleize(id),
      identity: 'Arena fighter',
      weaponName: 'Primary attack',
      visual: {
        shape: 'orb',
        bodyColor: 0x3c6078,
        bodyDarkColor: 0x132537,
        coreColor: 0xeef8ff,
        auraColor: 0x5eb8e8,
        accentColor: 0x8fdcff,
        horns: false
      }
    };
  }
}


function resolveArenaPresentation(id: string): { name: string; typeLabel: string } {
  try {
    const arena = getArena(id);
    return {
      name: arena.name,
      typeLabel: `${titleize(arena.size)} · ${titleize(arena.theme)} arena`
    };
  } catch {
    return { name: titleize(id), typeLabel: 'Arena' };
  }
}

function resolveAbilityName(id: string): string {
  return safeContentName(() => getAbility(id).name, id);
}

function resolvePrimaryAttackName(id: string): string {
  return safeContentName(() => getPrimaryAttack(id).name, id);
}

function resolveModeName(id: string): string {
  return safeContentName(() => getGameMode(id).name, id);
}

function safeContentName(resolve: () => string, fallbackId: string): string {
  try {
    return resolve();
  } catch {
    return titleize(fallbackId);
  }
}

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimer(tick: number): string {
  const totalSeconds = Math.max(0, Math.floor(tick / TICKS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
