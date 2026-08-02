import type { PassiveDefinition } from './schemas';

const PASSIVES: readonly PassiveDefinition[] = [
  {
    id: 'combat-analysis',
    name: 'Combat Analysis',
    description: 'Gunner primary-attack hits build Target Lock on the same enemy, up to four stacks.',
    triggers: [
      {
        event: 'ON_PRIMARY_HIT',
        conditions: [],
        actions: [
          { type: 'APPLY_STATUS_TARGET', statusId: 'target-lock', durationTicks: 180, stacks: 1 }
        ]
      }
    ]
  }
];

const PASSIVE_BY_ID = new Map(PASSIVES.map((passive) => [passive.id, passive]));

export function listPassives(): PassiveDefinition[] {
  return PASSIVES.map((passive) => ({
    ...passive,
    triggers: passive.triggers.map((trigger) => ({
      ...trigger,
      conditions: [...trigger.conditions],
      actions: [...trigger.actions]
    }))
  }));
}

export function getPassive(id: string): PassiveDefinition {
  const passive = PASSIVE_BY_ID.get(id);
  if (!passive) throw new Error(`Unknown passive: ${id}`);
  return passive;
}
