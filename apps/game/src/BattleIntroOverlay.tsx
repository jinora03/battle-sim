import type { FighterDefinition } from '@kinetic/content';
import { getVisualRecipe } from '@kinetic/visual-engine';
import { FighterPortrait } from './ui/FighterPortrait';
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

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function IntroFighter({
  fighter,
  teamSize,
  side
}: {
  fighter: FighterDefinition;
  teamSize: number;
  side: 'a' | 'b';
}) {
  const visual = getVisualRecipe(fighter.visualRecipeId);
  const identity = `${fighter.classification.elements.map(titleCase).join(' / ')} · ${titleCase(fighter.classification.archetype)}`;

  return (
    <article
      className={`battle-intro-fighter side-${side}`}
      aria-label={`${fighter.name}, ${identity}`}
    >
      <header className="battle-intro-nameplate">
        <strong>{fighter.name}</strong>
        <span className="battle-intro-identity">{identity}</span>
        {teamSize > 1 && <small className="battle-intro-squad">{teamSize} fighter squad</small>}
      </header>
      <FighterPortrait
        fighter={fighter}
        visual={visual}
        facing={side === 'a' ? 'right' : 'left'}
        size="large"
        className="battle-intro-avatar"
      />
    </article>
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
