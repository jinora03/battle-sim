import type { MountedAttachmentDefinition } from '../schemas';
import { cloneAttachment, compareModules } from './internal';
import { getFighterModule } from './moduleCatalog';

/**
 * Resolves physical presentation recipes from module ids once per fighter view.
 * The result order is deterministic and follows the resolved module slot order.
 */
export function listMountedAttachments(moduleIds: readonly string[]): MountedAttachmentDefinition[] {
  const attachments: MountedAttachmentDefinition[] = [];
  const modules = moduleIds
    .map((id) => getFighterModule(id))
    .sort(compareModules);
  for (const module of modules) {
    for (const attachment of module.attachments ?? []) attachments.push(cloneAttachment(attachment));
  }
  return attachments;
}
