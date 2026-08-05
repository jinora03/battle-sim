import type { CSSProperties } from 'react';
import type { FighterDefinition } from '@kinetic/content';
import type { VisualRecipe } from '@kinetic/visual-engine';

interface PortraitStyle extends CSSProperties {
  '--portrait-body': string;
  '--portrait-dark': string;
  '--portrait-core': string;
  '--portrait-aura': string;
  '--portrait-accent': string;
  '--portrait-scale': number;
}

export function FighterPortrait({
  fighter,
  visual,
  facing = 'right',
  size = 'medium',
  className = ''
}: {
  fighter: FighterDefinition;
  visual: VisualRecipe;
  facing?: 'left' | 'right';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
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
      className={`shared-fighter-portrait body-only size-${size} facing-${facing} shape-${visual.shape} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      <span className="shared-portrait-aura" />
      <span className={`shared-portrait-shell shape-${visual.shape}`}>
        {visual.shape === 'mech' && <><i className="shared-mech-cross horizontal" /><i className="shared-mech-cross vertical" /></>}
        {visual.shape === 'water' && <><i className="shared-water-bubble one" /><i className="shared-water-bubble two" /></>}
        {visual.shape === 'bomber' && <><i className="shared-bomber-ring" /><i className="shared-bomber-vents" /></>}
        {visual.horns && <i className="shared-portrait-horns" />}
      </span>
      <span className="shared-portrait-core" />
    </div>
  );
}

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
