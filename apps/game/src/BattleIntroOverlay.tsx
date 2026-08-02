import type { CSSProperties } from 'react';
import type { FighterDefinition } from '@kinetic/content';
import { getVisualRecipe } from '@kinetic/visual-engine';
import { NeonButton } from './ui/NeonUI';
import type { BattleLaunchPhase } from './ui/battleLaunch';

interface BattleIntroOverlayProps {
  phase: Exclude<BattleLaunchPhase, 'running'>;
  fighterA: FighterDefinition;
  fighterB: FighterDefinition;
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

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function introStyle(fighter: FighterDefinition): IntroStyle {
  const recipe = getVisualRecipe(fighter.visualRecipeId);
  return {
    '--intro-body': color(recipe.bodyColor),
    '--intro-dark': color(recipe.bodyDarkColor),
    '--intro-core': color(recipe.coreColor),
    '--intro-aura': color(recipe.auraColor),
    '--intro-accent': color(recipe.accentColor),
    '--intro-size-scale': Math.max(0.94, Math.min(1.2, fighter.physics.radius / 48))
  };
}

function IntroFighter({ fighter, teamSize, side }: { fighter: FighterDefinition; teamSize: number; side: 'a' | 'b' }) {
  return (
    <div className={`battle-intro-fighter side-${side}`} style={introStyle(fighter)}>
      <div className="battle-intro-nameplate">
        <small>{side === 'a' ? 'Team 1' : 'Team 2'}{teamSize > 1 ? ` · ${teamSize} fighters` : ''}</small>
        <strong>{fighter.name}</strong>
      </div>
      <div className="battle-intro-avatar" aria-hidden="true">
        <span className="battle-intro-aura" />
        <span className="battle-intro-shell" />
        <span className="battle-intro-core" />
        <span className="battle-intro-sight" />
      </div>
    </div>
  );
}

export function BattleIntroOverlay({
  phase,
  fighterA,
  fighterB,
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
          <IntroFighter fighter={fighterA} teamSize={teamSizeA} side="a" />
          <div className="battle-intro-versus" aria-hidden="true">
            <i />
            <strong>VS</strong>
            <i />
          </div>
          <IntroFighter fighter={fighterB} teamSize={teamSizeB} side="b" />
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
