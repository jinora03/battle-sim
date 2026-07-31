import type { CSSProperties } from 'react';
import { getAbility, type FighterDefinition } from '@kinetic/content';
import type { PlayerProfile } from '@kinetic/meta';
import { getSkillPresentation, getVisualRecipe } from '@kinetic/visual-engine';
import type { BattleSetup } from './runtime/BattleRuntime';
import { NeonButton } from './ui/NeonUI';

export type ReleaseView = 'home' | 'battle' | 'training' | 'roster' | 'creator' | 'profile';

interface QuickBattle {
  id: string;
  title: string;
  description: string;
  fighterAId: string;
  fighterBId: string;
  arenaId: string;
  modeId: string;
  teamSizeA: number;
  teamSizeB: number;
  controllerA: 'player' | 'ai';
  controllerB: 'player' | 'ai';
  accent: string;
}

const quickBattles: QuickBattle[] = [
  {
    id: 'first-splash', title: 'First Splash', description: 'Learn movement and skill timing as Water Shaper against Bomber.',
    fighterAId: 'water-shaper', fighterBId: 'bomber', arenaId: 'pillar-court', modeId: 'duel', teamSizeA: 1, teamSizeB: 1,
    controllerA: 'player', controllerB: 'ai', accent: '#48c9ff'
  },
  {
    id: 'frozen-flame', title: 'Frozen Flame', description: 'A compact elemental duel built around burn, freeze and momentum.',
    fighterAId: 'pyro-brawler', fighterBId: 'frost-warden', arenaId: 'cryo-ring', modeId: 'duel', teamSizeA: 1, teamSizeB: 1,
    controllerA: 'player', controllerB: 'ai', accent: '#ff7a45'
  },
  {
    id: 'arc-breaker', title: 'Arc Breaker', description: 'Fast electric offense against a massive mechanical defender.',
    fighterAId: 'volt-striker', fighterBId: 'mech-bruiser', arenaId: 'arc-crucible', modeId: 'duel', teamSizeA: 1, teamSizeB: 1,
    controllerA: 'player', controllerB: 'ai', accent: '#fff05b'
  },
  {
    id: 'raid-the-void', title: 'Raid the Void', description: 'Three Thorn Colossi challenge a scaled Void Reaper boss.',
    fighterAId: 'thorn-colossus', fighterBId: 'void-reaper', arenaId: 'pillar-court', modeId: 'boss-raid', teamSizeA: 3, teamSizeB: 1,
    controllerA: 'player', controllerB: 'ai', accent: '#8ee06c'
  }
];

export function ReleaseHome({ profile, fighters, arenaCount, modeCount, onNavigate, onStart }: {
  profile: PlayerProfile;
  fighters: FighterDefinition[];
  arenaCount: number;
  modeCount: number;
  onNavigate: (view: ReleaseView) => void;
  onStart: (setup: BattleSetup) => void;
}) {
  const unlocked = new Set(profile.unlockedFighterIds);
  const unlockedBuiltins = fighters.filter((fighter) => unlocked.has(fighter.id)).length;
  const currentLevelProgress = Math.max(0, Math.min(100, ((profile.xp % Math.max(180, profile.level * 180)) / Math.max(180, profile.level * 180)) * 100));

  const startQuick = (item: QuickBattle) => {
    onStart({
      fighterAId: item.fighterAId,
      fighterBId: item.fighterBId,
      controllerA: item.controllerA,
      controllerB: item.controllerB,
      arenaId: item.arenaId,
      modeId: item.modeId,
      teamSizeA: item.teamSizeA,
      teamSizeB: item.teamSizeB,
      friendlyFire: false,
      teamCollision: item.modeId === 'duel' ? 'full' : 'soft',
      difficulty: profile.difficulty
    });
  };

  return (
    <section className="release-home">
      <div className="release-hero-card">
        <div className="release-hero-copy">
          <p className="eyebrow">Kinetic Battle Engine 1.1 · Stage 7 + Stage 8</p>
          <h2>Build a fighter. Enter the arena. Let physics decide.</h2>
          <p>Control a modular combatant directly, watch deterministic AI battles, build custom fighters, or scale the same engine into team fights and mass skirmishes.</p>
          <div className="release-hero-actions">
            <NeonButton tone="success" size="large" onClick={() => startQuick(quickBattles[0]!)}>Quick play</NeonButton>
            <NeonButton tone="random" size="large" onClick={() => onNavigate('battle')}>Custom battle</NeonButton>
            <NeonButton tone="utility" size="large" onClick={() => onNavigate('training')}>Open Ability Lab</NeonButton>
            <NeonButton tone="ghost" size="large" onClick={() => onNavigate('roster')}>View roster</NeonButton>
          </div>
        </div>
        <div className="release-core-orbit" aria-hidden="true">
          <i className="orbit-ring one" /><i className="orbit-ring two" /><i className="orbit-ring three" />
          <strong>1.1</strong><span>MOBILE READY</span>
        </div>
      </div>

      <div className="release-overview-grid">
        <article><strong>{fighters.length}</strong><span>built-in + custom fighters</span></article>
        <article><strong>{arenaCount}</strong><span>arenas from compact pits to war fields</span></article>
        <article><strong>{modeCount}</strong><span>battle modes sharing one simulation</span></article>
        <article><strong>{unlockedBuiltins}</strong><span>fighters currently unlocked</span></article>
      </div>

      <section className="quick-battle-section">
        <div className="section-heading-row"><div><p className="eyebrow">Featured battles</p><h2>Jump into a designed matchup</h2></div><button className="text-link-button" onClick={() => onNavigate('battle')}>Open full Battle Lab →</button></div>
        <div className="quick-battle-grid">
          {quickBattles.map((item) => {
            const fighterA = fighters.find((fighter) => fighter.id === item.fighterAId);
            const fighterB = fighters.find((fighter) => fighter.id === item.fighterBId);
            const lockedIds = [item.fighterAId, item.fighterBId].filter((id) => !unlocked.has(id));
            return (
              <article className="quick-battle-card" key={item.id} style={{ '--quick-accent': item.accent } as CSSProperties}>
                <div className="quick-matchup"><FighterOrb fighter={fighterA} /><span>VS</span><FighterOrb fighter={fighterB} /></div>
                <p className="eyebrow">{item.modeId.replaceAll('-', ' ')} · {item.arenaId.replaceAll('-', ' ')}</p>
                <h3>{item.title}</h3><p>{item.description}</p>
                <NeonButton tone={lockedIds.length > 0 ? 'ghost' : 'success'} fullWidth disabled={lockedIds.length > 0} onClick={() => startQuick(item)}>{lockedIds.length > 0 ? `Unlock ${lockedIds.map(prettyId).join(' + ')}` : 'Start battle'}</NeonButton>
              </article>
            );
          })}
        </div>
      </section>

      <div className="release-lower-grid">
        <section className="panel-section release-progress-card">
          <div className="section-heading-row"><div><p className="eyebrow">Pilot profile</p><h2>{profile.displayName} · Level {profile.level}</h2></div><button className="text-link-button" onClick={() => onNavigate('profile')}>Open profile →</button></div>
          <div className="home-xp-track"><i style={{ width: `${currentLevelProgress}%` }} /></div>
          <div className="home-profile-stats"><span><strong>{profile.totals.battles}</strong>battles</span><span><strong>{profile.totals.wins}</strong>wins</span><span><strong>{profile.unlockedAchievementIds.length}</strong>achievements</span><span><strong>{profile.totals.abilitiesUsed}</strong>skills used</span></div>
        </section>
        <section className="panel-section how-to-card">
          <p className="eyebrow">How to play</p><h2>Three things to know</h2>
          <div className="how-to-step"><b>1</b><span><strong>Move with momentum</strong>WASD or the touch pad steers; walls and collisions preserve meaningful velocity.</span></div>
          <div className="how-to-step"><b>2</b><span><strong>Read the telegraph</strong>Every skill announces intent through its cast motion, arena effect and cooldown indicator.</span></div>
          <div className="how-to-step"><b>3</b><span><strong>Experiment</strong>Elements, mass, radius, AI profiles, arenas and abilities are modular—not fixed character classes.</span></div>
        </section>
      </div>

      <section className="release-roster-peek">
        <div className="section-heading-row"><div><p className="eyebrow">Release roster</p><h2>Eight different movement languages</h2></div><button className="text-link-button" onClick={() => onNavigate('roster')}>Compare all fighters →</button></div>
        <div className="roster-peek-strip">
          {fighters.filter((fighter) => !fighter.classification.traits.includes('custom')).slice(0, 8).map((fighter) => {
            const visual = getVisualRecipe(fighter.visualRecipeId);
            const ultimateId = fighter.abilitySlots.ultimate;
            const ultimate = ultimateId ? getAbility(ultimateId) : null;
            return <article key={fighter.id} style={{ '--fighter-color': colorHex(visual.bodyColor), '--fighter-core': colorHex(visual.coreColor) } as CSSProperties}><FighterOrb fighter={fighter} /><strong>{fighter.name}</strong><span>{fighter.classification.archetype}</span><small>{ultimate ? getSkillPresentation(ultimate.id).shortName : 'No ultimate'}</small>{!unlocked.has(fighter.id) && <em>LOCKED</em>}</article>;
          })}
        </div>
      </section>
    </section>
  );
}

function FighterOrb({ fighter }: { fighter?: FighterDefinition | undefined }) {
  if (!fighter) return <span className="mini-fighter-orb missing" />;
  const visual = getVisualRecipe(fighter.visualRecipeId);
  return <span className="mini-fighter-orb" style={{ '--fighter-color': colorHex(visual.bodyColor), '--fighter-dark': colorHex(visual.bodyDarkColor), '--fighter-core': colorHex(visual.coreColor), '--fighter-aura': colorHex(visual.auraColor) } as CSSProperties}><i /></span>;
}

function prettyId(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function colorHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
