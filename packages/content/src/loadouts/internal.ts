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
      ...(module.modifiers.primaryConeChannel
        ? { primaryConeChannel: { ...module.modifiers.primaryConeChannel } }
        : {}),
      ...(module.modifiers.statusDurationMultiplier
        ? { statusDurationMultiplier: { ...module.modifiers.statusDurationMultiplier } }
        : {}),
      ...(module.modifiers.statusStacksAppliedBonus
        ? { statusStacksAppliedBonus: { ...module.modifiers.statusStacksAppliedBonus } }
        : {}),
      ...(module.modifiers.abilityDamageMultiplier
        ? { abilityDamageMultiplier: { ...module.modifiers.abilityDamageMultiplier } }
        : {}),
      ...(module.modifiers.abilityImpulseMultiplier
        ? { abilityImpulseMultiplier: { ...module.modifiers.abilityImpulseMultiplier } }
        : {}),
      ...(module.modifiers.abilityRadiusMultiplier
        ? { abilityRadiusMultiplier: { ...module.modifiers.abilityRadiusMultiplier } }
        : {}),
      ...(module.modifiers.abilitySelfImpulseMultiplier
        ? { abilitySelfImpulseMultiplier: { ...module.modifiers.abilitySelfImpulseMultiplier } }
        : {}),
      ...(module.modifiers.resourceGainMultiplier
        ? { resourceGainMultiplier: { ...module.modifiers.resourceGainMultiplier } }
        : {}),
      ...(module.modifiers.resourceDecayMultiplier
        ? { resourceDecayMultiplier: { ...module.modifiers.resourceDecayMultiplier } }
        : {}),
      ...(module.modifiers.resourceThresholdIncomingDamageMultiplier
        ? { resourceThresholdIncomingDamageMultiplier: { ...module.modifiers.resourceThresholdIncomingDamageMultiplier } }
        : {}),
      ...(module.modifiers.periodicStatusPulses
        ? { periodicStatusPulses: module.modifiers.periodicStatusPulses.map((pulse) => ({ ...pulse })) }
        : {})
    }
  };
}
