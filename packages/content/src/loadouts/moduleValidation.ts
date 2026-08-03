import type { FighterModuleDefinition } from '../schemas';

export function validateModuleCatalog(modules: readonly FighterModuleDefinition[]): void {
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
      if (name === 'statusStacksAppliedBonus') {
        for (const [statusId, bonus] of Object.entries(value as Record<string, number>)) {
          if (!Number.isInteger(bonus) || bonus < 0) throw new Error(`Module ${module.id} has invalid ${statusId} stack bonus`);
        }
        continue;
      }
      if (name === 'resourceThresholdIncomingDamageMultiplier') {
        const rule = value as NonNullable<FighterModuleDefinition['modifiers']['resourceThresholdIncomingDamageMultiplier']>;
        if (!rule.resourceId || rule.thresholdRatio < 0 || rule.thresholdRatio > 1 || rule.multiplier <= 0) {
          throw new Error(`Module ${module.id} has an invalid resource damage threshold`);
        }
        continue;
      }
      if (name === 'periodicStatusPulses') {
        for (const pulse of value as NonNullable<FighterModuleDefinition['modifiers']['periodicStatusPulses']>) {
          if (
            !pulse.statusId
            || pulse.radius <= 0
            || !Number.isInteger(pulse.intervalTicks)
            || pulse.intervalTicks <= 0
            || !Number.isInteger(pulse.durationTicks)
            || pulse.durationTicks <= 0
            || !Number.isInteger(pulse.stacks)
            || pulse.stacks <= 0
            || (pulse.minimumResource ?? 0) < 0
            || (pulse.resourceId === undefined && pulse.minimumResource !== undefined)
          ) {
            throw new Error(`Module ${module.id} has an invalid periodic status pulse`);
          }
        }
        continue;
      }
      if (typeof value === 'object' && value !== null) {
        for (const [entryId, multiplier] of Object.entries(value as Record<string, number>)) {
          if (typeof multiplier !== 'number' || multiplier <= 0) throw new Error(`Module ${module.id} has invalid ${name}.${entryId}`);
        }
        continue;
      }
      if (name === 'primaryProjectileMaxWallBounces' || name === 'primaryProjectilePenetration') {
        if (typeof value === 'number' && value < 0) throw new Error(`Module ${module.id} has a negative ${name}`);
        continue;
      }
      if (typeof value === 'number' && value <= 0) throw new Error(`Module ${module.id} must have a positive ${name}`);
    }
  }
}
