import type { CSSProperties } from 'react';
import {
  getFighterModule,
  getPrimaryAttack,
  type FighterDefinition,
  type MountedAttachmentDefinition
} from '@kinetic/content';
import { getVisualRecipe } from '@kinetic/visual-engine';
import { NeonButton } from './ui/NeonUI';
import type { BattleLaunchPhase } from './ui/battleLaunch';

interface BattleIntroOverlayProps {
  phase: Exclude<BattleLaunchPhase, 'running'>;
  fighterA: FighterDefinition;
  fighterB: FighterDefinition;
  moduleIdsA: readonly string[];
  moduleIdsB: readonly string[];
  teamSizeA: number;
  teamSizeB: number;
  modeName: string;
  startDisabled: boolean;
  onStart: () => void;
}

interface IntroStyle extends CSSProperties {
  '--intro-body': string;
  '--intro-dark': string;
  '--intro-core': string;
  '--intro-aura': string;
  '--intro-accent': string;
  '--intro-size-scale': number;
}

interface AttachmentStyle extends CSSProperties {
  '--attachment-primary': string;
  '--attachment-accent': string;
  '--attachment-glow': string;
  '--attachment-scale': number;
}

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function introStyle(fighter: FighterDefinition): IntroStyle {
  const recipe = getVisualRecipe(fighter.visualRecipeId);
  return {
    '--intro-body': color(recipe.bodyColor),
    '--intro-dark': color(recipe.bodyDarkColor),
    '--intro-core': color(recipe.coreColor),
    '--intro-aura': color(recipe.auraColor),
    '--intro-accent': color(recipe.accentColor),
    '--intro-size-scale': Math.max(0.92, Math.min(1.16, fighter.physics.radius / 48))
  };
}

function attachmentStyle(attachment: MountedAttachmentDefinition): AttachmentStyle {
  return {
    '--attachment-primary': color(attachment.primaryColor),
    '--attachment-accent': color(attachment.accentColor),
    '--attachment-glow': color(attachment.glowColor ?? attachment.accentColor),
    '--attachment-scale': attachment.scale ?? 1
  };
}

function getConfiguredAttachments(moduleIds: readonly string[]): MountedAttachmentDefinition[] {
  return moduleIds.flatMap((moduleId) => {
    try {
      return getFighterModule(moduleId).attachments ?? [];
    } catch {
      return [];
    }
  });
}

function IntroFighter({
  fighter,
  moduleIds,
  teamSize,
  side
}: {
  fighter: FighterDefinition;
  moduleIds: readonly string[];
  teamSize: number;
  side: 'a' | 'b';
}) {
  const visual = getVisualRecipe(fighter.visualRecipeId);
  const primary = getPrimaryAttack(fighter.primaryAttackId);
  const attachments = getConfiguredAttachments(moduleIds);
  const tuned = moduleIds.length > 0;
  const displayName = `${fighter.name}${tuned ? ' · Tuned Version' : ''}`;
  const identity = `${fighter.classification.elements.map(titleCase).join(' / ')} · ${titleCase(fighter.classification.archetype)}`;

  return (
    <article
      className={`battle-intro-fighter side-${side} ${tuned ? 'tuned' : 'standard'}`}
      style={introStyle(fighter)}
      aria-label={`${displayName}, ${identity}, weapon ${primary.name}`}
    >
      <header className="battle-intro-nameplate">
        <strong>{displayName}</strong>
        <span className="battle-intro-identity">{identity}</span>
        <span className="battle-intro-weapon-name">{primary.name}</span>
        {teamSize > 1 && <small className="battle-intro-squad">{teamSize} fighter squad</small>}
      </header>
      <div className={`battle-intro-avatar shape-${visual.shape}`} aria-hidden="true">
        <span className="battle-intro-aura" />
        <span className={`battle-intro-shell shape-${visual.shape}`}>
          {visual.horns && <i className="battle-intro-horns" />}
        </span>
        <span className="battle-intro-core" />
        <span className={`battle-intro-weapon form-${primary.form} style-${primary.style}`} />
        {attachments.slice(0, 6).map((attachment) => (
          <span
            className={`battle-intro-attachment kind-${attachment.kind} mount-${attachment.mountPoint}`}
            style={attachmentStyle(attachment)}
            key={attachment.id}
          />
        ))}
      </div>
    </article>
  );
}

export function BattleIntroOverlay({
  phase,
  fighterA,
  fighterB,
  moduleIdsA,
  moduleIdsB,
  teamSizeA,
  teamSizeB,
  modeName,
  startDisabled,
  onStart
}: BattleIntroOverlayProps) {
  const isReady = phase === 'ready';

  return (
    <div
      className={`battle-launch-overlay ${phase}`}
      role={isReady ? 'dialog' : 'status'}
      aria-label={isReady ? 'Battle ready to start' : `${fighterA.name} versus ${fighterB.name}`}
      aria-live={isReady ? 'off' : 'polite'}
    >
      <div className="battle-intro-vignette" aria-hidden="true" />
      <div className="battle-intro-content">
        <p className="battle-intro-kicker">{isReady ? 'Match prepared' : modeName}</p>
        <div className="battle-intro-matchup">
          <IntroFighter fighter={fighterA} moduleIds={moduleIdsA} teamSize={teamSizeA} side="a" />
          <div className="battle-intro-versus" aria-hidden="true">
            <i />
            <strong>VS</strong>
            <i />
          </div>
          <IntroFighter fighter={fighterB} moduleIds={moduleIdsB} teamSize={teamSizeB} side="b" />
        </div>
        {isReady ? (
          <div className="battle-ready-actions">
            <p>The arena is paused. Start when you are ready.</p>
            <NeonButton tone="success" className="battle-ready-start" onClick={onStart} disabled={startDisabled}>
              {startDisabled ? 'Preparing arena…' : 'Start Battle'}
            </NeonButton>
          </div>
        ) : (
          <div className="battle-intro-start-flash" aria-hidden="true">
            <span>Battle</span>
            <strong>Start</strong>
          </div>
        )}
      </div>
    </div>
  );
}
