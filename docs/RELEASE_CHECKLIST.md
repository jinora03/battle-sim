# v1.0 Local Release & Evaluation Checklist

## Environment

- [ ] `node -v` reports 22.12 or newer
- [ ] Delete stale `node_modules` and `package-lock.json` after changing Node major versions
- [ ] `npm install`
- [ ] `npm run check`
- [ ] `npm run dev`
- [ ] `npm run preview` after a successful build

## Core flow

- [ ] Home screen loads
- [ ] Quick Play starts Water vs Bomber
- [ ] Roster displays eight built-in fighters
- [ ] Locked roster entries cannot be selected until unlocked
- [ ] Battle Lab creates compatible arena/mode combinations
- [ ] New random battle changes seed
- [ ] Replay same battle preserves seed
- [ ] Player vs AI and AI vs AI both run

## Fighter kits

For each built-in fighter:

- [ ] Basic works
- [ ] Skill 1 works
- [ ] Skill 2 works
- [ ] Skill 3 works
- [ ] Ultimate works
- [ ] UI shows ready/casting/cooldown
- [ ] Telegraph and resolve are distinguishable
- [ ] Audio cue does not produce errors

## Arenas and modes

- [ ] Iron Pit Duel
- [ ] Pillar Court Team Battle
- [ ] Elemental Foundry hazard battle
- [ ] War Basin Mass Skirmish
- [ ] Cryo Ring Duel/Survival
- [ ] Arc Crucible Duel/Team Battle/Boss Raid
- [ ] Battle Royale victory
- [ ] Boss Raid objective
- [ ] Survival timer/objective

## Persistence

- [ ] Profile persists after reload
- [ ] Achievements remain unlocked
- [ ] Fighter unlocks remain available
- [ ] Match history records completion
- [ ] Saved loadout reapplies correctly
- [ ] Fighter Lab bundle persists and imports/exports
- [ ] Settings persist and migrate

## Performance and accessibility

- [ ] High quality 1v1 at 60 FPS target
- [ ] Balanced team battle
- [ ] Battery profile at 30 FPS target
- [ ] Large battle uses automatic visual/audio scaling
- [ ] Reduced motion suppresses shake/flash/freeze
- [ ] High contrast is readable
- [ ] Effects, trails, shake and audio can be independently disabled
- [ ] Hidden tab pauses and resumes safely

## Mobile

- [ ] Capacitor platform added locally
- [ ] `npm run mobile:sync`
- [ ] Android/iOS project compiles
- [ ] Portrait and landscape layouts
- [ ] Safe-area/notch spacing
- [ ] Touch movement and five skill buttons
- [ ] Back/background/resume behavior
- [ ] Physical-device heat, battery and frame pacing

## Evaluation handoff

- [ ] Record feedback using `docs/EVALUATION_GUIDE.md`
- [ ] Include seed and setup for reproducible bugs
- [ ] Separate blockers from visual/polish preferences
- [ ] Use findings to define v1.1 priorities
