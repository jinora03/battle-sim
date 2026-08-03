import type { PassiveDefinition } from './schemas';

const PASSIVES: readonly PassiveDefinition[] = [
  {
    id: 'living-furnace',
    name: 'Living Furnace',
    description: 'Fire damage and new Burn stacks build Heat. Flame Jet hits also feed the furnace directly.',
    triggers: [
      {
        event: 'ON_PRIMARY_HIT',
        conditions: [],
        actions: [
          { type: 'MODIFY_RESOURCE_SELF', resourceId: 'heat', amount: 2 }
        ]
      },
      {
        event: 'ON_PRIMARY_HIT',
        conditions: [{ type: 'SELF_HAS_STATUS', statusId: 'meltdown' }],
        actions: [
          { type: 'DEAL_DAMAGE_TARGET', amount: 3, element: 'fire' },
          { type: 'APPLY_STATUS_TARGET', statusId: 'burn', durationTicks: 160, stacks: 1 }
        ]
      }
    ]
  },
  {
    id: 'house-rules',
    name: 'House Rules',
    description: 'Skip Stone launches already-light targets harder, and Last Call adds a second weighted impact.',
    triggers: [
      {
        event: 'ON_PRIMARY_HIT',
        conditions: [{ type: 'TARGET_HAS_STATUS', statusId: 'featherlight', minimumStacks: 2 }],
        actions: [
          { type: 'APPLY_KNOCKBACK_TARGET', magnitude: 2.5 }
        ]
      },
      {
        event: 'ON_PRIMARY_HIT',
        conditions: [
          { type: 'SELF_HAS_STATUS', statusId: 'last-call' },
          { type: 'TARGET_HAS_STATUS', statusId: 'featherlight', minimumStacks: 1 }
        ],
        actions: [
          { type: 'DEAL_DAMAGE_TARGET', amount: 2.5, element: 'void' },
          { type: 'APPLY_KNOCKBACK_TARGET', magnitude: 3.5 }
        ]
      }
    ]
  },
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
