import { z } from 'zod';
import type { AbilitySlot, Element, ModuleSlot } from '@kinetic/protocol';
import { elementSchema } from './internal';
import { combatResourceSchema, type CombatResourceDefinition } from './resourceSchema';

export interface FighterDefinition {
  id: string;
  name: string;
  classification: {
    archetype: string;
    elements: Element[];
    traits: string[];
  };
  physics: {
    radius: number;
    mass: number;
    restitution: number;
    linearDamping: number;
    maxSpeed: number;
  };
  stats: {
    maxHp: number;
    moveAcceleration: number;
  };
  aiProfileId: string | null;
  /** Built-in kit that authorizes this custom fighter's weapon, skills and modules. */
  kitSourceFighterId?: string | null;
  /** Zero or more developer-authored passives. They never consume an input slot. */
  passiveIds?: string[];
  /** Optional deterministic resources such as Heat, Charge, Rage or Frost. */
  combatResources?: CombatResourceDefinition[];
  abilitySlots: Partial<Record<AbilitySlot, string | null>>;
  /** Approved module choices by slot. Players may only select from these ids. */
  moduleSlots?: Partial<Record<ModuleSlot, string[]>>;
  defaultModuleIds?: string[];
  resistances: Partial<Record<Element, number>>;
  visualRecipeId: string;
  animationRecipeId: string;
  audioProfileId: string;
  /** The authoritative source for the Basic attack and its rendered silhouette. */
  primaryAttackId: string;
  /** @deprecated Migrated to primaryAttackId when importing old fighter bundles. */
  weaponId?: string | null;
}

export const MIN_FIGHTER_RADIUS = 45;

export const fighterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  classification: z.object({
    archetype: z.string().min(1),
    elements: z.array(elementSchema).min(1),
    traits: z.array(z.string())
  }),
  physics: z.object({
    radius: z.number().min(MIN_FIGHTER_RADIUS),
    mass: z.number().positive(),
    restitution: z.number().min(0).max(1.25),
    linearDamping: z.number().min(0).max(1),
    maxSpeed: z.number().positive()
  }),
  stats: z.object({
    maxHp: z.number().positive(),
    moveAcceleration: z.number().positive()
  }),
  aiProfileId: z.string().nullable(),
  kitSourceFighterId: z.string().min(1).nullable().optional(),
  passiveIds: z.array(z.string()).default([]),
  combatResources: z.array(combatResourceSchema).default([]),
  abilitySlots: z.object({
    basic: z.string().nullable().optional(),
    skill1: z.string().nullable().optional(),
    skill2: z.string().nullable().optional(),
    skill3: z.string().nullable().optional(),
    ultimate: z.string().nullable().optional()
  }),
  moduleSlots: z.object({
    offense: z.array(z.string()).optional(),
    defense: z.array(z.string()).optional(),
    mobility: z.array(z.string()).optional(),
    utility: z.array(z.string()).optional()
  }).default({}),
  defaultModuleIds: z.array(z.string()).default([]),
  resistances: z.partialRecord(elementSchema, z.number().positive()).default({}),
  visualRecipeId: z.string(),
  animationRecipeId: z.string(),
  audioProfileId: z.string(),
  primaryAttackId: z.string().min(1),
  weaponId: z.string().nullable().optional()
});
