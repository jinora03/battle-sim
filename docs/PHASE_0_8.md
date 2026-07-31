# Phase 0.8 — Progression, Achievements & Persistent Game Structure

## Goal

Turn the battle engine into a persistent game shell without allowing progression concerns to leak into physics, AI, abilities, rendering, or fighter definitions.

```text
Simulation events + battle completion summary
                    ↓
               Meta package
      ├── achievements
      ├── profile XP / level
      ├── fighter unlocks
      ├── cumulative statistics
      ├── challenges
      ├── match history
      └── battle loadouts
                    ↓
          versioned local save
```

## Player profile

The browser stores a versioned `PlayerProfile` under `kinetic.player-profile.v2`. It contains:

- display name, XP, and level
- Relaxed / Standard / Intense difficulty
- unlocked fighter IDs
- unlocked achievement IDs
- claimed challenge IDs
- lifetime battle statistics and personal bests
- arenas and modes played
- latest 30 match summaries
- up to 12 reusable battle loadouts

Import uses a best-effort migration/sanitization layer rather than trusting arbitrary JSON directly.

## Achievements and fighter unlocks

Achievements consume the existing semantic event stream and current battle statistics. They do not call combat systems or mutate fighter state.

Current examples:

- **First Blood** — first knockout; unlocks Pyro Brawler
- **Pinball** — 8 wall impacts in one battle
- **Demolition Demo** — 4 blasts in one battle
- **Wrecking Ball** — destroy an arena object; unlocks Mech Bruiser
- **Skill Storm** — 12 skill activations in one battle
- **Untouchable** — a surviving fighter took no damage
- **Hazard Course** — survive 4 hazard triggers

The developer unlock button remains available because the project is still an engine testbed.

## Challenges

Challenges aggregate profile totals across multiple matches and automatically award XP once:

- complete 3 battles
- win 2 player-controlled battles
- activate 50 skills
- fight in 3 arenas
- destroy 2 arena objects

## Match completion

`BattleRuntime` emits one `BattleCompletionSummary` when a battle ends. The summary contains the immutable battle definition, duration, winner, player team, difficulty, and per-entity statistics. The profile layer converts that into a compact `MatchRecord`.

The callback is deliberately outside the simulation runner. A headless simulation still works without a profile.

## Difficulty

Difficulty applies only when a player-controlled team exists:

- **Relaxed:** lower enemy HP, damage, and speed; reduced XP multiplier
- **Standard:** baseline values
- **Intense:** moderately stronger enemies; increased XP multiplier

AI-vs-AI simulations remain neutral so difficulty does not distort simulator comparisons.

## Seed UX correction

The engine remains deterministic, but normal player UX is now:

- **New random battle:** generates a fresh secure browser seed
- **Replay same battle:** reuses the current seed
- **Advanced seed:** manually applies a seed for debugging or sharing

Automated tests continue to use fixed seeds.

## Loadouts

A battle preset stores:

- both fighter IDs and controller sources
- arena and mode
- team sizes
- friendly-fire and ally-collision rules
- difficulty

Applying a loadout starts a fresh random battle; it does not imply replaying an old seed.

## Deliberately deferred

- cloud accounts and cross-device sync
- currencies, shops, inventories, equipment rarity, or grind loops
- daily/weekly server-timed challenges
- campaign map and narrative progression
- online leaderboards
- anti-cheat validation of profile saves
