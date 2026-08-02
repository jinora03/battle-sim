import { Graphics } from 'pixi.js';
import type { MountedAttachmentDefinition } from '@kinetic/content';
import type { EntitySnapshot } from '@kinetic/protocol';
import { drawMountedAttachments } from '../mountedAttachments';
import type { VisualLod } from './types';

export class MountedAttachmentView {
  readonly graphics = new Graphics();

  constructor(private readonly definitions: readonly MountedAttachmentDefinition[]) {}

  update(
    entity: EntitySnapshot,
    elapsedSeconds: number,
    uiAngle: number,
    reducedMotion: boolean,
    lod: VisualLod,
    visible: boolean
  ): void {
    this.graphics.visible = visible;
    if (!visible) return;
    drawMountedAttachments(this.graphics, this.definitions, {
      entityId: entity.id,
      radius: entity.radius,
      elapsedSeconds,
      counterRotation: uiAngle,
      reducedMotion,
      lod
    });
  }

  reset(): void {
    this.graphics.clear();
  }
}
