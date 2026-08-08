import { useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { FighterDefinition } from '@kinetic/content';
import {
  getChallengeProgress,
  listAchievementDefinitions,
  listDifficultyPresets,
  serializePlayerProfile,
  xpToNextLevel,
  type PlayerProfile,
  type ProgressionNotice,
  type SavedBattlePreset
} from '@kinetic/meta';
import type { BattleSetup } from './runtime/BattleSetup';
import { requestDeveloperAccess } from './developerAccess';
import { NeonButton } from './ui/NeonUI';

export interface ProfileViewProps {
  profile: PlayerProfile;
  fighters: FighterDefinition[];
  currentSetup: BattleSetup;
  notices: ProgressionNotice[];
  onChangeName(name: string): void;
  onChangeDifficulty(difficulty: PlayerProfile['difficulty']): void;
  onSaveLoadout(name: string): void;
  onApplyLoadout(preset: SavedBattlePreset): void;
  onDeleteLoadout(id: string): void;
  onUnlockAll(): void;
  onImportProfile(json: string): void;
  onResetProfile(): void;
}

export function ProfileView({
  profile,
  fighters,
  currentSetup,
  notices,
  onChangeName,
  onChangeDifficulty,
  onSaveLoadout,
  onApplyLoadout,
  onDeleteLoadout,
  onUnlockAll,
  onImportProfile,
  onResetProfile
}: ProfileViewProps) {
  const [loadoutName, setLoadoutName] = useState('My Battle Setup');
  const [importText, setImportText] = useState('');
  const achievements = useMemo(() => listAchievementDefinitions(), []);
  const challenges = useMemo(() => getChallengeProgress(profile), [profile]);
  const xp = xpToNextLevel(profile);
  const fighterName = (id: string) => fighters.find((fighter) => fighter.id === id)?.name ?? id.replaceAll('-', ' ');
  const unlocked = new Set(profile.unlockedFighterIds);

  return (
    <section className="profile-workspace">
      <div className="profile-main-column">
        <section className="profile-hero-card">
          <div>
            <p className="eyebrow">Persistent player profile</p>
            <input className="profile-name-input" value={profile.displayName} maxLength={40} onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeName(event.target.value)} />
            <p>Level {profile.level} · {profile.xp.toLocaleString()} total XP</p>
          </div>
          <div className="level-emblem">{profile.level}</div>
          <div className="profile-xp-track"><i style={{ width: `${xp.progress * 100}%` }} /><span>{xp.current} / {xp.required} XP</span></div>
        </section>

        <section className="profile-stat-grid">
          <ProfileMetric label="Battles" value={profile.totals.battles.toLocaleString()} />
          <ProfileMetric label="Wins" value={profile.totals.wins.toLocaleString()} />
          <ProfileMetric label="Damage" value={Math.round(profile.totals.damageDealt).toLocaleString()} />
          <ProfileMetric label="Skills" value={profile.totals.abilitiesUsed.toLocaleString()} />
          <ProfileMetric label="Best damage" value={Math.round(profile.bests.damageDealt).toLocaleString()} />
          <ProfileMetric label="Best impact" value={profile.bests.maxImpact.toFixed(1)} />
        </section>

        <section className="profile-panel">
          <div className="profile-panel-heading"><div><p className="eyebrow">Fighter roster</p><h2>Unlocks</h2></div><span>{profile.unlockedFighterIds.length}/{fighters.filter((fighter) => !fighter.classification.traits.includes('custom')).length} built-ins</span></div>
          <div className="unlock-grid">
            {fighters.map((fighter) => {
              const isCustom = fighter.classification.traits.includes('custom');
              const isUnlocked = isCustom || unlocked.has(fighter.id);
              return (
                <article className={`unlock-card ${isUnlocked ? 'unlocked' : 'locked'}`} key={fighter.id}>
                  <span className={`unlock-orb element-${fighter.classification.elements[0] ?? 'neutral'}`}>{isUnlocked ? '✓' : '◆'}</span>
                  <div><strong>{fighter.name}</strong><small>{isCustom ? 'Custom content' : isUnlocked ? 'Available in Battle Lab' : unlockHint(fighter.id)}</small></div>
                </article>
              );
            })}
          </div>
          <NeonButton tone="ghost" fullWidth onClick={() => { if (requestDeveloperAccess('unlock all fighters')) onUnlockAll(); }}>Developer: unlock all fighters</NeonButton>
        </section>

        <section className="profile-panel">
          <div className="profile-panel-heading"><div><p className="eyebrow">Milestones</p><h2>Challenges</h2></div><span>{challenges.filter((item) => item.claimed).length}/{challenges.length}</span></div>
          <div className="challenge-list">
            {challenges.map((challenge) => (
              <article className={`challenge-row ${challenge.claimed ? 'claimed' : challenge.complete ? 'complete' : ''}`} key={challenge.id}>
                <div><strong>{challenge.name}</strong><small>{challenge.description}</small></div>
                <div className="challenge-progress"><span><i style={{ width: `${challenge.progress / challenge.target * 100}%` }} /></span><b>{challenge.progress}/{challenge.target}</b><em>{challenge.claimed ? 'CLAIMED' : `+${challenge.xp} XP`}</em></div>
              </article>
            ))}
          </div>
        </section>

        <section className="profile-panel">
          <div className="profile-panel-heading"><div><p className="eyebrow">Permanent records</p><h2>Achievements</h2></div><span>{profile.unlockedAchievementIds.length}/{achievements.length}</span></div>
          <div className="achievement-grid">
            {achievements.map((achievement) => {
              const obtained = profile.unlockedAchievementIds.includes(achievement.id);
              return (
                <article className={obtained ? 'obtained' : ''} key={achievement.id}>
                  <span>{obtained ? '★' : '☆'}</span>
                  <div><strong>{achievement.name}</strong><small>{achievement.description}</small>{achievement.unlockFighterId && <em>Unlocks {fighterName(achievement.unlockFighterId)}</em>}</div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="profile-panel">
          <div className="profile-panel-heading"><div><p className="eyebrow">Recent simulations</p><h2>Match history</h2></div><span>latest {profile.matchHistory.length}</span></div>
          {profile.matchHistory.length === 0 ? <p className="small-note">Completed battles will appear here.</p> : (
            <div className="match-history-list">
              {profile.matchHistory.slice(0, 12).map((match) => (
                <article key={match.id} className={`match-record ${match.outcome}`}>
                  <span className="match-result">{match.outcome.toUpperCase()}</span>
                  <div><strong>{match.modeId.replaceAll('-', ' ')} · {match.arenaId.replaceAll('-', ' ')}</strong><small>{match.participants.slice(0, 4).map((item) => fighterName(item.fighterId)).join(' vs ')}{match.participants.length > 4 ? ` +${match.participants.length - 4}` : ''}</small></div>
                  <div className="match-numbers"><b>+{match.xpEarned} XP</b><span>{Math.round(match.totals.damageDealt)} dmg · {(match.durationTicks / 60).toFixed(1)}s</span></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="profile-side-column">
        {notices.length > 0 && (
          <section className="profile-panel notice-history">
            <p className="eyebrow">Latest rewards</p>
            {notices.slice(-6).reverse().map((notice, index) => <div key={`${notice.title}-${index}`}><strong>{notice.title}</strong><small>{notice.description}</small></div>)}
          </section>
        )}

        <section className="profile-panel">
          <p className="eyebrow">Difficulty</p>
          <h2>Opponent scaling</h2>
          <select value={profile.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChangeDifficulty(event.target.value as PlayerProfile['difficulty'])}>
            {listDifficultyPresets().map((difficulty) => <option value={difficulty.id} key={difficulty.id}>{difficulty.name}</option>)}
          </select>
          <p className="small-note">{listDifficultyPresets().find((item) => item.id === profile.difficulty)?.description}</p>
        </section>

        <section className="profile-panel">
          <p className="eyebrow">Battle presets</p>
          <h2>Loadouts</h2>
          <input value={loadoutName} maxLength={32} onChange={(event: ChangeEvent<HTMLInputElement>) => setLoadoutName(event.target.value)} />
          <NeonButton tone="success" fullWidth onClick={() => onSaveLoadout(loadoutName.trim() || 'Battle Setup')}>Save current setup</NeonButton>
          <div className="loadout-list">
            {profile.loadouts.length === 0 ? <p className="small-note">Save fighter, arena, mode, team and difficulty combinations here.</p> : profile.loadouts.map((preset) => (
              <article key={preset.id} className={profile.selectedLoadoutId === preset.id ? 'selected' : ''}>
                <button className="loadout-main" onClick={() => onApplyLoadout(preset)}><strong>{preset.name}</strong><small>{fighterName(preset.fighterAId)} vs {fighterName(preset.fighterBId)} · {preset.modeId.replaceAll('-', ' ')}</small></button>
                <button className="loadout-delete" onClick={() => onDeleteLoadout(preset.id)} aria-label={`Delete ${preset.name}`}>×</button>
              </article>
            ))}
          </div>
          <div className="current-preset-note">Current: {fighterName(currentSetup.fighterAId)} vs {fighterName(currentSetup.fighterBId)} · {currentSetup.difficulty}</div>
        </section>

        <section className="profile-panel">
          <p className="eyebrow">Portable save</p>
          <h2>Export / import</h2>
          <NeonButton tone="utility" fullWidth onClick={() => downloadText(serializePlayerProfile(profile), `kinetic-profile-${profile.playerId}.json`)}>Export profile JSON</NeonButton>
          <textarea value={importText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setImportText(event.target.value)} placeholder="Paste an exported profile here" />
          <NeonButton tone="random" fullWidth onClick={() => onImportProfile(importText)}>Import profile</NeonButton>
          <NeonButton tone="danger" fullWidth onClick={onResetProfile}>Reset progression</NeonButton>
        </section>
      </aside>
    </section>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

function unlockHint(fighterId: string): string {
  if (fighterId === 'pyro-brawler') return 'Unlock: First Blood';
  if (fighterId === 'mech-bruiser') return 'Unlock: Wrecking Ball';
  return 'Locked by progression';
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
