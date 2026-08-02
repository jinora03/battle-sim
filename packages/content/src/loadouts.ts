import type { FighterLoadout, ModuleSlot } from '@kinetic/protocol';
import type {
  FighterDefinition,
  FighterModuleDefinition,
  MountedAttachmentDefinition,
  ResolvedFighterLoadout
} from './schemas';

const MODULE_SLOT_ORDER: Record<ModuleSlot, number> = {
  offense: 0,
  defense: 1,
  mobility: 2,
  utility: 3
};

const MODULES: readonly FighterModuleDefinition[] = [
  {
    id: 'ricochet-chamber',
    name: 'Ricochet Chamber',
    description: 'Primary bullets bounce once from walls and obstacles, but deal 10% less damage.',
    slot: 'offense',
    compatibleFighterIds: ['gunner'],
    modifiers: {
      primaryDamageMultiplier: 0.9,
      primaryProjectileBounce: 0.82,
      primaryProjectileMaxWallBounces: 1
    }
  },
  {
    id: 'piercing-barrel',
    name: 'Piercing Barrel',
    description: 'Primary bullets can pass through one enemy, but the burst cooldown is 12% longer.',
    slot: 'offense',
    compatibleFighterIds: ['gunner'],
    modifiers: {
      primaryCooldownMultiplier: 1.12,
      primaryProjectilePenetration: 1
    }
  },
  {
    id: 'shoulder-missile-pod',
    name: 'Shoulder Missile Pod',
    description: 'A visible launcher upgrades Gunner skill projectiles with 12% more damage and stronger tracking.',
    slot: 'offense',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-shoulder-missile-pod',
        kind: 'missile-pod',
        mountPoint: 'top',
        rotationMode: 'target',
        forward: 0.32,
        lateral: -1.14,
        scale: 1.48,
        primaryColor: 0x263645,
        accentColor: 0xffb347,
        glowColor: 0xffd76a,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.072,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      skillProjectileDamageMultiplier: 1.12,
      skillProjectileHomingMultiplier: 1.08
    }
  },
  {
    id: 'deflector-plate',
    name: 'Deflector Plate',
    description: 'Visible armor reduces incoming damage and knockback by 10%, but lowers top speed by 5%.',
    slot: 'defense',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-deflector-plate',
        kind: 'deflector-plate',
        mountPoint: 'front',
        rotationMode: 'body',
        forward: 1.3,
        scale: 1.42,
        primaryColor: 0x31485d,
        accentColor: 0x7de5ff,
        glowColor: 0x65d8ff,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.075,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      incomingDamageMultiplier: 0.9,
      incomingKnockbackMultiplier: 0.9,
      maxSpeedMultiplier: 0.95
    }
  },
  {
    id: 'recoil-thrusters',
    name: 'Recoil Thrusters',
    description: 'Twin rear thrusters increase acceleration by 14% and top speed by 6%, but receive 5% more knockback.',
    slot: 'mobility',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-recoil-thruster-left',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.22,
        lateral: -0.58,
        scale: 1.24,
        primaryColor: 0x263645,
        accentColor: 0x65d8ff,
        glowColor: 0xffd76a,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.068,
        hideInMassBattle: true
      },
      {
        id: 'gunner-recoil-thruster-right',
        kind: 'thruster',
        mountPoint: 'rear',
        rotationMode: 'body',
        forward: -1.22,
        lateral: 0.58,
        scale: 1.24,
        primaryColor: 0x263645,
        accentColor: 0x65d8ff,
        glowColor: 0xffd76a,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.068,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      moveAccelerationMultiplier: 1.14,
      maxSpeedMultiplier: 1.06,
      incomingKnockbackMultiplier: 1.05
    }
  },
  {
    id: 'targeting-drone',
    name: 'Targeting Drone',
    description: 'Target Lock lasts 35% longer and skill missiles track more aggressively.',
    slot: 'utility',
    compatibleFighterIds: ['gunner'],
    attachments: [
      {
        id: 'gunner-targeting-drone',
        kind: 'targeting-drone',
        mountPoint: 'orbit',
        rotationMode: 'orbit',
        scale: 1.36,
        primaryColor: 0x1c3344,
        accentColor: 0xffd76a,
        glowColor: 0x65d8ff,
        outlineColor: 0xf7fcff,
        outlineWidthScale: 0.07,
        orbitRadius: 2.14,
        orbitSpeed: 1.9,
        hideInMassBattle: true
      }
    ],
    modifiers: {
      statusDurationMultiplier: { 'target-lock': 1.35 },
      skillProjectileHomingMultiplier: 1.2
    }
  }
];

function validateModuleCatalog(modules: readonly FighterModuleDefinition[]): void {
  const moduleIds = new Set<string>();
  const attachmentIds = new Set<string>();
  for (const module of modules) {
    if (moduleIds.has(module.id)) throw new Error(`Duplicate fighter module id: ${module.id}`);
    moduleIds.add(module.id);
    for (const attachment of module.attachments ?? []) {
      if (attachmentIds.has(attachment.id)) throw new Error(`Duplicate mounted attachment id: ${attachment.id}`);
      attachmentIds.add(attachment.id);
      if ((attachment.scale ?? 1) <= 0) throw new Error(`Mounted attachment ${attachment.id} must have a positive scale`);
      if ((attachment.orbitRadius ?? 1) <= 0) throw new Error(`Mounted attachment ${attachment.id} must have a positive orbit radius`);
      if ((attachment.outlineWidthScale ?? 0.065) <= 0) throw new Error(`Mounted attachment ${attachment.id} must have a positive outline width scale`);
    }
    for (const [name, value] of Object.entries(module.modifiers)) {
      if (name === 'primaryProjectileMaxWallBounces' || name === 'primaryProjectilePenetration') {
        if (typeof value === 'number' && value < 0) throw new Error(`Module ${module.id} has a negative ${name}`);
        continue;
      }
      if (typeof value === 'number' && value <= 0) throw new Error(`Module ${module.id} must have a positive ${name}`);
    }
  }
}

validateModuleCatalog(MODULES);

const MODULE_BY_ID = new Map(MODULES.map((module) => [module.id, module]));

function cloneAttachment(attachment: MountedAttachmentDefinition): MountedAttachmentDefinition {
  return { ...attachment };
}

function cloneModule(module: FighterModuleDefinition): FighterModuleDefinition {
  return {
    ...module,
    compatibleFighterIds: [...module.compatibleFighterIds],
    ...(module.attachments ? { attachments: module.attachments.map(cloneAttachment) } : {}),
    modifiers: {
      ...module.modifiers,
      ...(module.modifiers.statusDurationMultiplier
        ? { statusDurationMultiplier: { ...module.modifiers.statusDurationMultiplier } }
        : {})
    }
  };
}

export function listFighterModules(): FighterModuleDefinition[] {
  return MODULES.map(cloneModule);
}

export function getFighterModule(id: string): FighterModuleDefinition {
  const module = MODULE_BY_ID.get(id);
  if (!module) throw new Error(`Unknown fighter module: ${id}`);
  return module;
}

export function listCompatibleModules(fighter: FighterDefinition, slot?: ModuleSlot): FighterModuleDefinition[] {
  return MODULES
    .filter((module) => (!slot || module.slot === slot)
      && module.compatibleFighterIds.includes(fighter.id)
      && (fighter.moduleSlots?.[module.slot] ?? []).includes(module.id))
    .map(cloneModule);
}

/**
 * Resolves physical presentation recipes from module ids once per fighter view.
 * The result order is deterministic and follows the resolved module slot order.
 */
export function listMountedAttachments(moduleIds: readonly string[]): MountedAttachmentDefinition[] {
  const attachments: MountedAttachmentDefinition[] = [];
  const modules = moduleIds
    .map((id) => getFighterModule(id))
    .sort((a, b) => MODULE_SLOT_ORDER[a.slot] - MODULE_SLOT_ORDER[b.slot]
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const module of modules) {
    for (const attachment of module.attachments ?? []) attachments.push(cloneAttachment(attachment));
  }
  return attachments;
}

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

  const modules = [...selectedBySlot.values()].sort((a, b) => MODULE_SLOT_ORDER[a.slot] - MODULE_SLOT_ORDER[b.slot]
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
