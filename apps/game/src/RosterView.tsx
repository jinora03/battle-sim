import type { CSSProperties } from 'react';
import { getAbility, getPassive, getPrimaryAttack, listCompatibleModules, type FighterDefinition } from '@kinetic/content';
import type { PlayerProfile } from '@kinetic/meta';
import { getSkillPresentation, getVisualRecipe } from '@kinetic/visual-engine';
import { NeonButton } from './ui/NeonUI';

export function RosterView({ fighters, profile, onPlayAs, onSetOpponent }: {
  fighters: FighterDefinition[];
  profile: PlayerProfile;
  onPlayAs: (fighterId: string) => void;
  onSetOpponent: (fighterId: string) => void;
}) {
  const unlocked = new Set(profile.unlockedFighterIds);
  return (
    <section className="roster-view">
      <div className="roster-heading">
        <div><p className="eyebrow">Core roster</p><h2>Choose a combat language, not just a stat block</h2><p>Each fighter has a developer-authored combat identity: weapon, optional passive, combo-focused skills, AI behavior and a controlled set of compatible modules.</p></div>
      </div>
      <div className="release-roster-grid">
        {fighters.map((fighter) => {
          const visual = getVisualRecipe(fighter.visualRecipeId);
          const locked = !fighter.classification.traits.includes('custom') && !unlocked.has(fighter.id);
          const passives = (fighter.passiveIds ?? []).map((passiveId) => getPassive(passiveId));
          const compatibleModules = listCompatibleModules(fighter);
          return (
            <article className={`release-fighter-card ${locked ? 'locked' : ''}`} key={fighter.id} style={{ '--fighter-color': hex(visual.bodyColor), '--fighter-dark': hex(visual.bodyDarkColor), '--fighter-core': hex(visual.coreColor), '--fighter-aura': hex(visual.auraColor) } as CSSProperties}>
              <div className="release-fighter-portrait"><span className={`portrait-body shape-${visual.shape}`}><i /></span>{locked && <b>LOCKED</b>}</div>
              <div className="release-fighter-copy"><p className="eyebrow">{fighter.classification.elements.join(' + ')} · {fighter.classification.archetype}</p><h3>{fighter.name}</h3><div className="fighter-traits">{fighter.classification.traits.map((trait) => <span key={trait}>{trait}</span>)}</div></div>
              <div className="fighter-stat-bars">
                <StatBar label="HP" value={fighter.stats.maxHp} max={400} />
                <StatBar label="Speed" value={fighter.physics.maxSpeed} max={15} />
                <StatBar label="Mass" value={fighter.physics.mass} max={6} />
                <StatBar label="Bounce" value={fighter.physics.restitution} max={1.1} />
              </div>
              <div className="release-skill-row">
                {(['basic','skill1','skill2','skill3','ultimate'] as const).map((slot) => {
                  if (slot === 'basic') {
                    const primary = getPrimaryAttack(fighter.primaryAttackId);
                    return <span className="roster-skill" key={slot} title={`${primary.name} · ${primary.form} + ${primary.behavior} · ${(primary.cooldownTicks / 60).toFixed(1)}s`} style={{ '--skill-color': hex(primaryColor(primary.form)) } as CSSProperties}><b>{primaryIcon(primary.form)}</b><small>{primary.name}</small></span>;
                  }
                  const abilityId = fighter.abilitySlots[slot];
                  if (!abilityId) return <span className="roster-skill empty" key={slot}>—</span>;
                  const ability = getAbility(abilityId);
                  const recipe = getSkillPresentation(abilityId);
                  return <span className={`roster-skill ${slot === 'ultimate' ? 'ultimate' : ''}`} key={slot} title={`${ability.name} · ${(ability.cooldownTicks / 60).toFixed(1)}s`} style={{ '--skill-color': hex(recipe.color) } as CSSProperties}><b>{recipe.icon}</b><small>{recipe.shortName}</small></span>;
                })}
              </div>
              {(passives.length > 0 || compatibleModules.length > 0) && (
                <div className="fighter-identity-summary">
                  {passives.map((passive) => <div key={passive.id}><span>Passive</span><strong>{passive.name}</strong><small>{passive.description}</small></div>)}
                  {compatibleModules.length > 0 && <div><span>Approved modules</span><strong>{compatibleModules.map((module) => module.name).join(' · ')}</strong><small>Selected in Battle Setup; modules adjust this fighter's authored kit rather than replacing it.</small></div>}
                </div>
              )}
              <div className="release-fighter-actions"><NeonButton tone="success" disabled={locked} onClick={() => onPlayAs(fighter.id)}>Play as</NeonButton><NeonButton tone="utility" disabled={locked} onClick={() => onSetOpponent(fighter.id)}>Set as opponent</NeonButton></div>
              {locked && <p className="unlock-hint">Unlock through achievements, or use the developer unlock inside Profile while evaluating v1.0.</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const ratio = Math.max(0.04, Math.min(1, value / max));
  return <div><span>{label}</span><i><b style={{ width: `${ratio * 100}%` }} /></i><strong>{value < 10 ? value.toFixed(1) : Math.round(value)}</strong></div>;
}

function hex(value: number): string { return `#${value.toString(16).padStart(6, '0')}`; }

function primaryIcon(form: string): string {
  const icons: Record<string, string> = { sword: 'SW', spear: 'SP', hammer: 'HM', axe: 'AX', claws: 'CL', rifle: 'RF', launcher: 'BM', shield: 'SH', gauntlet: 'GT', fire: 'FI', water: 'WA', ice: 'IC', lightning: 'LT', nature: 'NT', void: 'VD' };
  return icons[form] ?? 'AT';
}

function primaryColor(form: string): number {
  const colors: Record<string, number> = { fire: 0xff6a32, water: 0x4fd9ff, ice: 0xa9f3ff, lightning: 0xffef58, nature: 0x8be26b, void: 0xb06cff, rifle: 0x7de8ff, launcher: 0xffbb62, gauntlet: 0x91a9bd, sword: 0xffd38a, spear: 0xc8eeff, hammer: 0xd5d9df, axe: 0xcaf8ff, claws: 0xb7f58e, shield: 0xaad9ff };
  return colors[form] ?? 0xd5f4ff;
}
