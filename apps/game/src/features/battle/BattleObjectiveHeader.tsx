interface TeamHealthSummary {
  team: number;
  alive: number;
  total: number;
  hp: number;
  hpRatio: number;
}

interface BattleObjectiveHeaderProps {
  kind: string;
  modeName: string;
  objectiveLabel: string;
  fighterAName: string;
  fighterBName: string;
  lastTeamStanding: boolean;
  teams: readonly TeamHealthSummary[];
  objectiveProgress: number;
  remainingTicks: number | null;
  battleEnded: boolean;
  resultLabel: string;
  activeEntityCount: number;
}

export function BattleObjectiveHeader({
  kind,
  modeName,
  objectiveLabel,
  fighterAName,
  fighterBName,
  lastTeamStanding,
  teams,
  objectiveProgress,
  remainingTicks,
  battleEnded,
  resultLabel,
  activeEntityCount
}: BattleObjectiveHeaderProps) {
  return (
    <header className={`battle-objective-bar ${kind}`} aria-label="Battle objective and team status">
      <div className="objective-summary">
        <small>{modeName} · {objectiveLabel}</small>
        <strong><span>{fighterAName}</span><i aria-hidden="true">vs</i><span>{fighterBName}</span></strong>
      </div>

      {lastTeamStanding ? (
        <div className="objective-progress elimination-progress" aria-label="Team health and fighters remaining">
          {teams.map((team) => (
            <div className="team-progress-lane" key={team.team} title={`Team ${team.team}: ${Math.round(team.hpRatio * 100)}% health, ${team.alive} of ${team.total} fighters alive`}>
              <div className="team-progress-heading">
                <b>Team {team.team}</b>
                <small>{team.alive}/{team.total} alive</small>
              </div>
              <div className="team-progress-track">
                <span className="team-progress-fill" style={{ width: `${team.hp > 0 ? Math.max(2, team.hpRatio * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="objective-progress objective-single-track" aria-label={`${Math.round(objectiveProgress * 100)}% objective progress`}>
          <i style={{ width: `${Math.max(2, objectiveProgress * 100)}%` }} />
        </div>
      )}

      <div className="objective-meta">
        {remainingTicks !== null && <b>{Math.ceil(remainingTicks / 60)}s</b>}
        {(battleEnded || !lastTeamStanding) && <em>{battleEnded ? resultLabel : `${activeEntityCount} active`}</em>}
      </div>
    </header>
  );
}
