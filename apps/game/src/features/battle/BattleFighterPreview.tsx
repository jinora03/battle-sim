import type { CSSProperties } from 'react';
import {
  getAbility,
  getPassive,
  getPrimaryAttack,
  type FighterDefinition
} from '@kinetic/content';
import { getSkillPresentation, getVisualRecipe } from '@kinetic/visual-engine';
import { FighterPortrait } from '../../ui/FighterPortrait';

export function BattleFighterPreview({ fighter, side }: {
  fighter: FighterDefinition;
  side: 'A' | 'B';
}) {
  const visual = getVisualRecipe(fighter.visualRecipeId);
  const primary = getPrimaryAttack(fighter.primaryAttackId);
  const passive = fighter.passiveIds?.[0] ? getPassive(fighter.passiveIds[0]) : undefined;
  const style = {
    '--setup-fighter-body': color(visual.bodyColor),
    '--setup-fighter-dark': color(visual.bodyDarkColor),
    '--setup-fighter-core': color(visual.coreColor),
    '--setup-fighter-aura': color(visual.auraColor),
    '--setup-fighter-accent': color(visual.accentColor)
  } as CSSProperties;

  return (
    <article className={`battle-fighter-preview side-${side.toLowerCase()}`} style={style} aria-label={`${fighter.name} skills and passive`}>
      <div className="battle-fighter-preview-portrait">
        <FighterPortrait fighter={fighter} visual={visual} facing={side === 'A' ? 'right' : 'left'} size="medium" />
      </div>
      <div className="battle-fighter-preview-copy">
        {passive && (
          <div className="battle-fighter-preview-passive">
            <small>Passive</small>
            <strong>{passive.name}</strong>
            <span>{passive.description}</span>
          </div>
        )}
        <div className="battle-fighter-preview-skills" aria-label={`${fighter.name} skills`}>
          <span className="basic" title={primary.name}><small>B</small><b>{primary.name}</b></span>
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
      </div>
    </article>
  );
}

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
