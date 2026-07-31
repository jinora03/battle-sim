import { CONTENT_VERSION } from '@kinetic/content';
import type {
  ActivateAbilityCommand,
  ActivatePrimaryAttackCommand,
  BattleDefinition,
  MoveCommand,
  ReplayData,
  ReplayFrame,
  ReplayMovementRun,
  SimulationCommand,
  StopCommand
} from '@kinetic/protocol';
import { ENGINE_VERSION } from '@kinetic/simulation';

export class ReplayRecorder {
  private readonly frames: ReplayFrame[] = [];
  private readonly completedMovementRuns: ReplayMovementRun[] = [];
  private readonly activeMovementRuns = new Map<number, ReplayMovementRun>();
  private readonly movementSeenAtTick = new Map<number, number>();
  private recordedCommandCount = 0;
  private storedActionCommandCount = 0;
  private logicalFrameCount = 0;

  constructor(private battle: BattleDefinition) {}

  /** Number of logical ticks that contained at least one input command. */
  get frameCount(): number {
    return this.logicalFrameCount;
  }

  /** Number of commands before replay compression. */
  get commandCount(): number {
    return this.recordedCommandCount;
  }

  /** Number of stored action commands plus movement runs. */
  get storedCommandCount(): number {
    return this.storedActionCommandCount + this.completedMovementRuns.length + this.activeMovementRuns.size;
  }

  get movementRunCount(): number {
    return this.completedMovementRuns.length + this.activeMovementRuns.size;
  }

  /** Fraction of logical commands removed by lossless run-length encoding. */
  get compressionRatio(): number {
    if (this.recordedCommandCount === 0) return 0;
    return Math.max(0, 1 - this.storedCommandCount / this.recordedCommandCount);
  }

  record(tick: number, commands: readonly SimulationCommand[]): void {
    if (commands.length > 0) this.logicalFrameCount += 1;
    this.recordedCommandCount += commands.length;

    let storedCommands: SimulationCommand[] | null = null;
    let duplicateMovementEntities: number[] | null = null;

    for (const command of commands) {
      if (command.type !== 'move') {
        (storedCommands ??= []).push(cloneCommand(command));
        continue;
      }

      const entityId = command.entityId;
      if (this.movementSeenAtTick.get(entityId) === tick) {
        // Multiple movement commands for one entity in one tick are exceptional.
        // Preserve them verbatim rather than collapsing simulation semantics.
        if (!duplicateMovementEntities?.includes(entityId)) (duplicateMovementEntities ??= []).push(entityId);
        continue;
      }
      this.movementSeenAtTick.set(entityId, tick);
      this.recordMovement(tick, command);
    }

    if (duplicateMovementEntities) {
      for (const entityId of duplicateMovementEntities) {
        this.removeMovementAtTick(entityId, tick);
        for (const command of commands) {
          if (command.type === 'move' && command.entityId === entityId) {
            (storedCommands ??= []).push(cloneMove(command));
          }
        }
      }
    }

    // A missing move command means no acceleration was applied on this tick.
    // Close the previous run so playback emits movement only on original ticks.
    for (const entityId of this.activeMovementRuns.keys()) {
      if (this.movementSeenAtTick.get(entityId) !== tick) this.finishMovementRun(entityId);
    }

    if (storedCommands && storedCommands.length > 0) {
      this.frames.push({ tick, commands: storedCommands });
      this.storedActionCommandCount += storedCommands.length;
    }
  }

  reset(battle: BattleDefinition): void {
    this.battle = battle;
    this.frames.length = 0;
    this.completedMovementRuns.length = 0;
    this.activeMovementRuns.clear();
    this.movementSeenAtTick.clear();
    this.recordedCommandCount = 0;
    this.storedActionCommandCount = 0;
    this.logicalFrameCount = 0;
  }

  export(): ReplayData {
    const movementRuns = [
      ...this.completedMovementRuns.map(cloneMovementRun),
      ...Array.from(this.activeMovementRuns.values(), cloneMovementRun)
    ].sort((a, b) => a.startTick - b.startTick || a.command.entityId - b.command.entityId || a.endTick - b.endTick);

    return {
      schemaVersion: 2,
      engineVersion: ENGINE_VERSION,
      contentVersion: CONTENT_VERSION,
      battle: structuredClone(this.battle),
      frames: this.frames.map((frame) => ({ tick: frame.tick, commands: frame.commands.map(cloneCommand) })),
      movementRuns
    };
  }

  private recordMovement(tick: number, command: MoveCommand): void {
    const active = this.activeMovementRuns.get(command.entityId);
    if (active && active.endTick === tick - 1 && sameMove(active.command, command)) {
      active.endTick = tick;
      return;
    }
    if (active) this.finishMovementRun(command.entityId);
    this.activeMovementRuns.set(command.entityId, {
      startTick: tick,
      endTick: tick,
      command: cloneMove(command)
    });
  }


  private removeMovementAtTick(entityId: number, tick: number): void {
    const run = this.activeMovementRuns.get(entityId);
    if (!run || run.endTick !== tick) return;
    if (run.startTick === tick) {
      this.activeMovementRuns.delete(entityId);
      return;
    }
    run.endTick = tick - 1;
    this.finishMovementRun(entityId);
  }

  private finishMovementRun(entityId: number): void {
    const run = this.activeMovementRuns.get(entityId);
    if (!run) return;
    this.completedMovementRuns.push(run);
    this.activeMovementRuns.delete(entityId);
  }
}

function sameMove(a: MoveCommand, b: MoveCommand): boolean {
  return a.entityId === b.entityId
    && a.direction.x === b.direction.x
    && a.direction.y === b.direction.y
    && a.facing?.x === b.facing?.x
    && a.facing?.y === b.facing?.y
    && (a.facing === undefined) === (b.facing === undefined);
}

function cloneMove(command: MoveCommand): MoveCommand {
  return {
    type: 'move',
    entityId: command.entityId,
    direction: { x: command.direction.x, y: command.direction.y },
    ...(command.facing ? { facing: { x: command.facing.x, y: command.facing.y } } : {})
  };
}

function cloneMovementRun(run: ReplayMovementRun): ReplayMovementRun {
  return { startTick: run.startTick, endTick: run.endTick, command: cloneMove(run.command) };
}

function cloneCommand(command: SimulationCommand): SimulationCommand {
  if (command.type === 'move') return cloneMove(command);
  if (command.type === 'stop') {
    const stop: StopCommand = { type: 'stop', entityId: command.entityId };
    return stop;
  }
  if (command.type === 'activatePrimaryAttack') {
    const attack: ActivatePrimaryAttackCommand = {
      type: 'activatePrimaryAttack',
      entityId: command.entityId,
      ...(command.targetId !== undefined ? { targetId: command.targetId } : {}),
      ...(command.direction ? { direction: { x: command.direction.x, y: command.direction.y } } : {})
    };
    return attack;
  }
  const ability: ActivateAbilityCommand = {
    type: 'activateAbility',
    entityId: command.entityId,
    slot: command.slot,
    ...(command.targetId !== undefined ? { targetId: command.targetId } : {}),
    ...(command.direction ? { direction: { x: command.direction.x, y: command.direction.y } } : {})
  };
  return ability;
}
