import type { FighterLoadout, ModuleSlot } from '@kinetic/protocol';
import type {
  FighterDefinition,
  FighterModuleDefinition,
  MountedAttachmentDefinition,
  ResolvedFighterLoadout
} from '../schemas';
import { cloneAttachment, cloneModule, compareModules } from './internal';
import { getFighterModule } from './moduleCatalog';

export function resolveFighterLoadout(fighter: FighterDefinition, requested?: FighterLoadout): ResolvedFighterLoadout {
  const requestedIds = requested?.moduleIds ?? fighter.defaultModuleIds ?? [];
  const selectedBySlot = new Map<ModuleSlot, FighterModuleDefinition>();

  for (const moduleId of requestedIds) {
    const module = getFighterModule(moduleId);
    const allowed = fighter.moduleSlots?.[module.slot] ?? [];
    if (!module.compatibleFighterIds.includes(fighter.id) || !allowed.includes(module.id)) {
      throw new Error(`${fighter.name} cannot equip module ${module.id}`);
    }
    if (selectedBySlot.has(module.slot)) {
      throw new Error(`${fighter.name} can equip only one ${module.slot} module`);
    }
    selectedBySlot.set(module.slot, module);
  }

  const modules = [...selectedBySlot.values()].sort(compareModules);
  const mountedAttachments: MountedAttachmentDefinition[] = [];
  const statusDurationMultiplier: Record<string, number> = {};
  let primaryDamageMultiplier = 1;
  let primaryKnockbackMultiplier = 1;
  let primaryCooldownMultiplier = 1;
  let primaryProjectileBounce = 0;
  let primaryProjectileMaxWallBounces = 0;
  let primaryProjectilePenetration = 0;
  let skillProjectileHomingMultiplier = 1;
  let skillProjectileDamageMultiplier = 1;
  let incomingDamageMultiplier = 1;
  let incomingKnockbackMultiplier = 1;
  let moveAccelerationMultiplier = 1;
  let maxSpeedMultiplier = 1;

  for (const module of modules) {
    const modifier = module.modifiers;
    primaryDamageMultiplier *= modifier.primaryDamageMultiplier ?? 1;
    primaryKnockbackMultiplier *= modifier.primaryKnockbackMultiplier ?? 1;
    primaryCooldownMultiplier *= modifier.primaryCooldownMultiplier ?? 1;
    primaryProjectileBounce = Math.max(primaryProjectileBounce, modifier.primaryProjectileBounce ?? 0);
    primaryProjectileMaxWallBounces += modifier.primaryProjectileMaxWallBounces ?? 0;
    primaryProjectilePenetration += modifier.primaryProjectilePenetration ?? 0;
    skillProjectileHomingMultiplier *= modifier.skillProjectileHomingMultiplier ?? 1;
    skillProjectileDamageMultiplier *= modifier.skillProjectileDamageMultiplier ?? 1;
    incomingDamageMultiplier *= modifier.incomingDamageMultiplier ?? 1;
    incomingKnockbackMultiplier *= modifier.incomingKnockbackMultiplier ?? 1;
    moveAccelerationMultiplier *= modifier.moveAccelerationMultiplier ?? 1;
    maxSpeedMultiplier *= modifier.maxSpeedMultiplier ?? 1;
    for (const attachment of module.attachments ?? []) mountedAttachments.push(cloneAttachment(attachment));
    for (const [statusId, multiplier] of Object.entries(modifier.statusDurationMultiplier ?? {})) {
      statusDurationMultiplier[statusId] = (statusDurationMultiplier[statusId] ?? 1) * multiplier;
    }
  }

  return {
    moduleIds: modules.map((module) => module.id),
    modules: modules.map(cloneModule),
    mountedAttachments,
    primaryDamageMultiplier,
    primaryKnockbackMultiplier,
    primaryCooldownMultiplier,
    primaryProjectileBounce,
    primaryProjectileMaxWallBounces,
    primaryProjectilePenetration,
    statusDurationMultiplier,
    skillProjectileHomingMultiplier,
    skillProjectileDamageMultiplier,
    incomingDamageMultiplier,
    incomingKnockbackMultiplier,
    moveAccelerationMultiplier,
    maxSpeedMultiplier
  };
}
