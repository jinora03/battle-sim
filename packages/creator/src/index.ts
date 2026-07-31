import { z, type ZodError } from 'zod';
import {
  fighterSchema,
  hasFighter,
  isCustomFighter,
  registerFighter,
  validateFighterReferences,
  type FighterDefinition
} from '@kinetic/content';
import {
  hasMotionRecipe,
  hasVisualRecipe,
  isCustomMotionRecipe,
  isCustomVisualRecipe,
  registerMotionRecipe,
  registerVisualRecipe,
  type MotionRecipe,
  type VisualRecipe
} from '@kinetic/visual-engine';

export const FIGHTER_BUNDLE_SCHEMA_VERSION = 2 as const;

export interface FighterBundle {
  schemaVersion: typeof FIGHTER_BUNDLE_SCHEMA_VERSION;
  fighter: FighterDefinition;
  visualRecipe: VisualRecipe;
  motionRecipe: MotionRecipe;
}

export interface BundleValidationResult {
  success: boolean;
  bundle?: FighterBundle;
  errors: string[];
  migrated?: boolean;
}

const colorSchema = z.number().int().min(0).max(0xffffff);
const visualRecipeSchema = z.object({
  id: z.string().min(1),
  shape: z.enum(['orb', 'mech', 'water', 'bomber']),
  bodyColor: colorSchema,
  bodyDarkColor: colorSchema,
  coreColor: colorSchema,
  auraColor: colorSchema,
  accentColor: colorSchema,
  horns: z.boolean()
});
const motionRecipeSchema = z.object({
  id: z.string().min(1),
  speedStretch: z.number().min(0).max(1),
  impactSquash: z.number().min(0).max(1),
  lean: z.number().min(0).max(1),
  pulseAmount: z.number().min(0).max(0.3),
  pulseSpeed: z.number().min(0).max(12),
  weaponSpin: z.number().min(0).max(20)
});
const fighterBundleSchema = z.object({
  schemaVersion: z.literal(FIGHTER_BUNDLE_SCHEMA_VERSION),
  fighter: fighterSchema,
  visualRecipe: visualRecipeSchema,
  motionRecipe: motionRecipeSchema
});

const LEGACY_PRIMARY_ATTACK_MAP: Readonly<Record<string, string>> = {
  'ember-sword': 'duelist-sword',
  'tidal-spear': 'lancer-spear',
  'steel-hammer': 'war-hammer',
  'arc-rifle': 'arc-emitter',
  'demolition-bomb': 'demolition-bomb',
  'cryo-axe': 'frost-halberd',
  'thorn-claws': 'thorn-claws',
  'void-orbit-blade': 'void-scythe',
  'automatic-rifle': 'automatic-rifle'
};

function issuesToMessages(error: ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || 'bundle'}: ${issue.message}`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Migrates v1 Fighter Lab bundles into the authoritative-primary-attack model. */
export function migrateFighterBundle(input: unknown): { value: unknown; migrated: boolean } {
  const bundle = asRecord(input);
  if (!bundle) return { value: input, migrated: false };
  const fighter = asRecord(bundle.fighter);
  const visualRecipe = asRecord(bundle.visualRecipe);
  if (!fighter) return { value: input, migrated: false };

  const version = typeof bundle.schemaVersion === 'number' ? bundle.schemaVersion : 1;
  const hasPrimary = typeof fighter.primaryAttackId === 'string' && fighter.primaryAttackId.length > 0;
  if (version === FIGHTER_BUNDLE_SCHEMA_VERSION && hasPrimary && !('weapon' in (visualRecipe ?? {}))) {
    return { value: input, migrated: false };
  }

  const abilitySlots = asRecord(fighter.abilitySlots) ?? {};
  const legacyWeaponId = typeof fighter.weaponId === 'string' ? fighter.weaponId : '';
  const legacyBasic = typeof abilitySlots.basic === 'string' ? abilitySlots.basic : '';
  let primaryAttackId = hasPrimary ? String(fighter.primaryAttackId) : LEGACY_PRIMARY_ATTACK_MAP[legacyWeaponId];
  if (!primaryAttackId) primaryAttackId = legacyBasic === 'automatic-burst' ? 'automatic-rifle' : 'duelist-sword';
  if (legacyBasic === 'automatic-burst') primaryAttackId = 'automatic-rifle';

  const migratedSlots = { ...abilitySlots };
  delete migratedSlots.basic;
  const migratedFighter: Record<string, unknown> = { ...fighter, primaryAttackId, abilitySlots: migratedSlots };
  delete migratedFighter.weaponId;

  const migratedVisual = visualRecipe ? { ...visualRecipe } : visualRecipe;
  if (migratedVisual) delete migratedVisual.weapon;

  return {
    migrated: true,
    value: {
      ...bundle,
      schemaVersion: FIGHTER_BUNDLE_SCHEMA_VERSION,
      fighter: migratedFighter,
      visualRecipe: migratedVisual
    }
  };
}

export function validateFighterBundle(input: unknown): BundleValidationResult {
  const migration = migrateFighterBundle(input);
  const parsed = fighterBundleSchema.safeParse(migration.value);
  if (!parsed.success) return { success: false, errors: issuesToMessages(parsed.error), migrated: migration.migrated };
  const bundle = parsed.data as FighterBundle;
  const errors = validateFighterReferences(bundle.fighter);
  if (bundle.fighter.visualRecipeId !== bundle.visualRecipe.id) errors.push('fighter.visualRecipeId must match visualRecipe.id');
  if (bundle.fighter.animationRecipeId !== bundle.motionRecipe.id) errors.push('fighter.animationRecipeId must match motionRecipe.id');
  if (errors.length > 0) return { success: false, errors, migrated: migration.migrated };
  return { success: true, bundle, errors: [], migrated: migration.migrated };
}

export function registerFighterBundle(input: unknown, replace = false): FighterBundle {
  const result = validateFighterBundle(input);
  if (!result.success || !result.bundle) throw new Error(result.errors.join('\n'));
  const bundle = result.bundle;
  if (hasFighter(bundle.fighter.id) && !isCustomFighter(bundle.fighter.id)) throw new Error(`Built-in fighter IDs cannot be replaced: ${bundle.fighter.id}`);
  if (hasVisualRecipe(bundle.visualRecipe.id) && !isCustomVisualRecipe(bundle.visualRecipe.id)) throw new Error(`Built-in visual recipe IDs cannot be replaced: ${bundle.visualRecipe.id}`);
  if (hasMotionRecipe(bundle.motionRecipe.id) && !isCustomMotionRecipe(bundle.motionRecipe.id)) throw new Error(`Built-in motion recipe IDs cannot be replaced: ${bundle.motionRecipe.id}`);
  const mayReplace = replace || isCustomFighter(bundle.fighter.id);
  registerVisualRecipe(bundle.visualRecipe, { replace: mayReplace });
  registerMotionRecipe(bundle.motionRecipe, { replace: mayReplace });
  registerFighter(bundle.fighter, { replace: mayReplace });
  return bundle;
}

export function serializeFighterBundle(bundle: FighterBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function parseFighterBundle(json: string): BundleValidationResult {
  try {
    return validateFighterBundle(JSON.parse(json) as unknown);
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : 'Invalid JSON.'] };
  }
}

export function slugifyFighterId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'custom-fighter';
}
