import type { CSSProperties } from 'react';
import {
  getPrimaryAttack,
  listMountedAttachments,
  type FighterDefinition,
  type MountedAttachmentDefinition
} from '@kinetic/content';
import type { VisualRecipe } from '@kinetic/visual-engine';

interface PortraitStyle extends CSSProperties {
  '--portrait-body': string;
  '--portrait-dark': string;
  '--portrait-core': string;
  '--portrait-aura': string;
  '--portrait-accent': string;
  '--portrait-scale': number;
}

interface AttachmentStyle extends CSSProperties {
  '--portrait-attachment-primary': string;
  '--portrait-attachment-accent': string;
  '--portrait-attachment-glow': string;
  '--portrait-attachment-scale': number;
}

export function FighterPortrait({
  fighter,
  visual,
  moduleIds = [],
  facing = 'right',
  size = 'medium',
  className = ''
}: {
  fighter: FighterDefinition;
  visual: VisualRecipe;
  moduleIds?: readonly string[];
  facing?: 'left' | 'right';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  const primary = getPrimaryAttack(fighter.primaryAttackId);
  const attachments = safeAttachments(moduleIds);
  const style: PortraitStyle = {
    '--portrait-body': color(visual.bodyColor),
    '--portrait-dark': color(visual.bodyDarkColor),
    '--portrait-core': color(visual.coreColor),
    '--portrait-aura': color(visual.auraColor),
    '--portrait-accent': color(visual.accentColor),
    '--portrait-scale': Math.max(0.9, Math.min(1.22, fighter.physics.radius / 48))
  };

  return (
    <div
      className={`shared-fighter-portrait size-${size} facing-${facing} shape-${visual.shape} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      <span className="shared-portrait-aura" />
      <span className={`shared-portrait-shell shape-${visual.shape}`}>
        {visual.shape === 'mech' && <><i className="shared-mech-cross horizontal" /><i className="shared-mech-cross vertical" /></>}
        {visual.shape === 'water' && <><i className="shared-water-bubble one" /><i className="shared-water-bubble two" /></>}
        {visual.shape === 'bomber' && <i className="shared-bomber-rivets" />}
        {visual.horns && <i className="shared-portrait-horns" />}
      </span>
      <span className="shared-portrait-core" />
      <span className={`shared-portrait-weapon form-${primary.form} style-${primary.style}`} />
      {attachments.slice(0, 8).map((attachment) => (
        <span
          className={`shared-portrait-attachment kind-${attachment.kind} mount-${attachment.mountPoint}`}
          style={attachmentStyle(attachment)}
          key={attachment.id}
        />
      ))}
    </div>
  );
}

function safeAttachments(moduleIds: readonly string[]): MountedAttachmentDefinition[] {
  try {
    return listMountedAttachments(moduleIds);
  } catch {
    return [];
  }
}

function attachmentStyle(attachment: MountedAttachmentDefinition): AttachmentStyle {
  return {
    '--portrait-attachment-primary': color(attachment.primaryColor),
    '--portrait-attachment-accent': color(attachment.accentColor),
    '--portrait-attachment-glow': color(attachment.glowColor ?? attachment.accentColor),
    '--portrait-attachment-scale': attachment.scale ?? 1
  };
}

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
