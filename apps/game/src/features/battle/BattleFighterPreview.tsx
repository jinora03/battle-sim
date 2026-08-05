import type { CSSProperties } from 'react';
import {
  getAbility,
  getFighterModule,
  getPassive,
  getPrimaryAttack,
  type FighterDefinition
} from '@kinetic/content';
import { getSkillPresentation, getVisualRecipe } from '@kinetic/visual-engine';
import { FighterPortrait } from '../../ui/FighterPortrait';

export function BattleFighterPreview({ fighter, moduleIds, side }: {
  fighter: FighterDefinition;
  moduleIds: readonly string[];
  side: 'A' | 'B';
}) {
  const visual = getVisualRecipe(fighter.visualRecipeId);
  const primary = getPrimaryAttack(fighter.primaryAttackId);
  const passive = fighter.passiveIds?.[0] ? getPassive(fighter.passiveIds[0]) : undefined;
  const modules = moduleIds.flatMap((moduleId) => {
    try {
      return [getFighterModule(moduleId)];
    } catch {
      return [];
    }
  });
  const style = {
    '--setup-fighter-body': color(visual.bodyColor),
    '--setup-fighter-dark': color(visual.bodyDarkColor),
    '--setup-fighter-core': color(visual.coreColor),
    '--setup-fighter-aura': color(visual.auraColor),
    '--setup-fighter-accent': color(visual.accentColor)
  } as CSSProperties;
  return (
    <article className={`battle-fighter-preview side-${side.toLowerCase()} ${modules.length > 0 ? 'tuned' : 'standard'}`} style={style} aria-label={`${fighter.name} battle setup preview`}>
      <div className="battle-fighter-preview-portrait">
        <FighterPortrait fighter={fighter} visual={visual} moduleIds={moduleIds} facing={side === 'A' ? 'right' : 'left'} size="small" />
      </div>
      <div className="battle-fighter-preview-copy">
        <div className="battle-fighter-preview-title">
          <span>{fighter.classification.elements.join(' · ')} · {fighter.classification.archetype}</span>
          <strong>{fighter.name}{modules.length > 0 ? ' · Tuned Version' : ''}</strong>
        </div>
        <div className="battle-fighter-preview-meta">
          <span><small>Weapon</small><b>{primary.name}</b></span>
          {passive && <span><small>Passive</small><b>{passive.name}</b></span>}
        </div>
        <div className="battle-fighter-preview-skills" aria-label={`${fighter.name} skills`}>
          <span className="basic"><small>B</small><b>{primary.name}</b></span>
          {(['skill1', 'skill2', 'skill3', 'ultimate'] as const).map((slot) => {
            const abilityId = fighter.abilitySlots[slot];
            if (!abilityId) return null;
            const ability = getAbility(abilityId);
            const presentation = getSkillPresentation(abilityId);
            return (
              <span className={slot === 'ultimate' ? 'ultimate' : ''} key={slot} title={ability.name}>
                <small>{slot === 'ultimate' ? 'ULT' : slot.replace('skill', 'S')}</small>
                <b>{presentation.shortName}</b>
              </span>
            );
          })}
        </div>
        <div className="battle-fighter-preview-modules">
          <small>{modules.length > 0 ? `${modules.length} tuned module${modules.length === 1 ? '' : 's'}` : 'Standard configuration'}</small>
          {modules.length > 0 && <div>{modules.map((module) => <b key={module.id}>{module.name}</b>)}</div>}
        </div>
      </div>
    </article>
  );
}


function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
