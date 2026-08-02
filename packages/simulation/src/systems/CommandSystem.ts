import type {
  ActivateAbilityCommand,
  ActivatePrimaryAttackCommand,
  EntityId,
  SimulationCommand,
  SimulationEvent,
  Vec2
} from '@kinetic/protocol';
import { compareOrdinal } from '../order';

export interface CommandSystemHost {
  isAlive(entityId: EntityId): boolean;
  isChanneling(entityId: EntityId): boolean;
  applyMove(entityId: EntityId, direction: Vec2, facing?: Vec2): void;
  lockChannel(entityId: EntityId): void;
  stop(entityId: EntityId): void;
  activatePrimaryAttack(command: ActivatePrimaryAttackCommand, events: SimulationEvent[]): void;
  activateAbility(command: ActivateAbilityCommand, events: SimulationEvent[]): void;
}

/**
 * Applies a tick's commands in stable deterministic order.
 *
 * The reusable ordering buffer avoids allocating a copied command array on
 * every simulation tick while keeping command iteration isolated from callers.
 */
export class CommandSystem {
  private readonly orderedCommands: SimulationCommand[] = [];

  constructor(private readonly host: CommandSystemHost) {}

  process(commands: readonly SimulationCommand[], events: SimulationEvent[]): number {
    this.orderedCommands.length = 0;
    for (const command of commands) this.orderedCommands.push(command);
    this.orderedCommands.sort(
      (a, b) => a.entityId - b.entityId || compareOrdinal(a.type, b.type)
    );

    for (const command of this.orderedCommands) {
      if (!this.host.isAlive(command.entityId)) continue;

      if (command.type === 'move') {
        if (!this.host.isChanneling(command.entityId)) {
          this.host.applyMove(command.entityId, command.direction, command.facing);
        }
        continue;
      }

      if (command.type === 'stop') {
        if (this.host.isChanneling(command.entityId)) {
          this.host.lockChannel(command.entityId);
        } else {
          this.host.stop(command.entityId);
        }
        continue;
      }

      if (command.type === 'activatePrimaryAttack') {
        this.host.activatePrimaryAttack(command, events);
        continue;
      }

      if (command.slot === 'basic') {
        // Replay/custom-content migration: Basic is now the fighter's
        // authoritative primary attack.
        this.host.activatePrimaryAttack(
          {
            type: 'activatePrimaryAttack',
            entityId: command.entityId,
            ...(command.targetId !== undefined ? { targetId: command.targetId } : {}),
            ...(command.direction ? { direction: command.direction } : {})
          },
          events
        );
        continue;
      }

      this.host.activateAbility(command, events);
    }

    return this.orderedCommands.length;
  }
}
