import type { ModuleSlot } from '@kinetic/protocol';
import type { FighterModuleDefinition, MountedAttachmentDefinition } from '../schemas';

export const MODULE_SLOT_ORDER: Readonly<Record<ModuleSlot, number>> = {
  offense: 0,
  defense: 1,
  mobility: 2,
  utility: 3
};

export function compareModules(a: FighterModuleDefinition, b: FighterModuleDefinition): number {
  return MODULE_SLOT_ORDER[a.slot] - MODULE_SLOT_ORDER[b.slot]
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function cloneAttachment(attachment: MountedAttachmentDefinition): MountedAttachmentDefinition {
  return { ...attachment };
}

export function cloneModule(module: FighterModuleDefinition): FighterModuleDefinition {
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
