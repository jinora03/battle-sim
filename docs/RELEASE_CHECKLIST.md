# Stage 8.12 Release Checklist

Release target: **1.3.46-stage8.12**

Use this checklist after `npm run check` is green. Stage 8.12 is a stabilization release: do not add new features while completing this pass. Fix only release-blocking regressions.

## Automated gates

- [ ] `node -v` reports 22.12 or newer
- [ ] `npm install` completes from `package-lock.json`
- [ ] `npm run lint` passes
- [ ] `npm run check` passes
- [ ] production build loads with `npm run preview`
- [ ] `ENGINE_VERSION`, `CONTENT_VERSION`, root package version and game package version all report `1.3.46-stage8.12`
- [ ] Git working tree contains no unintended `.patch`, `.diff`, `.zip`, `.rej` or `.orig` artifacts

## Core battle smoke test

- [ ] Home, Roster, Battle and Ability Lab open without console errors
- [ ] Roster exposes all 12 built-in fighters
- [ ] 1v1 Duel starts, pauses, resumes and reaches a result
- [ ] Player vs AI and AI vs AI both run
- [ ] New random battle changes the seed
- [ ] Replay same battle preserves the seed and expected deterministic result
- [ ] Battle → another tab → Battle restores the arena renderer correctly

## Fighter/content sanity

For at least one melee/close-range, one projectile and one controller fighter:

- [ ] Basic works
- [ ] Skills 1–3 work
- [ ] Ultimate works
- [ ] UI shows ready/casting/cooldown states
- [ ] Telegraph and resolve are distinguishable
- [ ] Audio plays without console/audio errors

Spot-check the newest/most presentation-sensitive roster entries:

- [ ] Rocket Vanguard
- [ ] Solar Sentinel
- [ ] Ballast
- [ ] Gunner
- [ ] Pyro
- [ ] Bomber

## Creator export

- [ ] fresh creator defaults are Vertical, Custom preset, Maximum quality, Intro off and Highlights off
- [ ] Setup + seed generation works
- [ ] Randomize seed works
- [ ] Reuse current seed works
- [ ] Find best seeds returns ranked candidates
- [ ] selecting a ranked seed prepares/exports the selected battle
- [ ] current completed replay export works
- [ ] vertical export completes with audio
- [ ] landscape export completes with audio
- [ ] explicit MP4 output downloads with `.mp4`
- [ ] explicit WebM output downloads with `.webm`
- [ ] exported video/thumbnail filenames include fighter matchup names
- [ ] manual download works
- [ ] auto-download works when enabled
- [ ] queue/retry/cancel behavior still works

## Layout Preview / WebGL safety

- [ ] Layout Preview is disabled while a battle is actively running
- [ ] pausing the battle enables Layout Preview
- [ ] Refresh Preview works while paused/static
- [ ] Open full frame works while paused/static
- [ ] closing full frame leaves the arena visible
- [ ] completed/static battles can preview repeatedly without losing the arena

## Responsive/device pass

- [ ] desktop Battle layout
- [ ] desktop Creator Export layout
- [ ] narrow/mobile portrait layout
- [ ] short landscape layout
- [ ] near-square viewport
- [ ] round/watch-class viewport using `docs/STAGE_8_DEVICE_QA.md`
- [ ] touch controls remain usable
- [ ] reduced-motion and high-contrast settings remain readable

## Persistence

- [ ] profile persists after reload
- [ ] achievements/unlocks remain available
- [ ] match history records completion
- [ ] saved loadout reapplies correctly
- [ ] settings persist and migrate

## Mobile/native handoff

When preparing a native build:

- [ ] `npm run mobile:sync` completes
- [ ] Android/iOS project compiles on the appropriate local toolchain
- [ ] safe-area/notch spacing is correct
- [ ] background/resume behavior is stable
- [ ] physical-device heat, battery and frame pacing are acceptable

## Release closeout

- [ ] no release-blocking regression remains
- [ ] README reflects Stage 8.12
- [ ] release version is `1.3.46-stage8.12` everywhere it is expected
- [ ] final `npm run lint` passes
- [ ] final `npm run check` passes
- [ ] commit/tag the stable Stage 8.12 release only after the checks above are complete
