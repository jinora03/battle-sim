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
      if (name === 'primaryProjectileMaxWallBounces' || name === 'primaryProjectilePenetration') {
        if (typeof value === 'number' && value < 0) throw new Error(`Module ${module.id} has a negative ${name}`);
        continue;
      }
      if (typeof value === 'number' && value <= 0) throw new Error(`Module ${module.id} must have a positive ${name}`);
    }
  }
}
