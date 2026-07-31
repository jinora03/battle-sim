# v1.0 Evaluation Guide

Use this after playing enough battles to give one consolidated review. Do not worry about technical terminology; describe what you see and feel.

## 1. First impression

- Does the project feel like a game or still mainly like a development demo?
- Is the home/roster/battle navigation understandable?
- Which parts look strongest and weakest immediately?

## 2. Movement and physics

Test light, normal and heavy fighters.

- Do acceleration, bouncing, knockback and wall ricochets feel satisfying?
- Are fighters too floaty, too slow, too sticky or too difficult to control?
- Do large mass and fighter size communicate real weight?
- Do collision piles become confusing or broken?

## 3. Skill clarity

For several fighters, observe Basic, S1, S2, S3 and Ultimate.

- Can you identify that a skill has started before it resolves?
- Are the telegraph, cast motion, effect silhouette and UI indicator consistent?
- Which skills look too similar?
- Which skills feel weak despite being mechanically strong?
- Are cooldowns and cast progress understandable?

## 4. Character identity

- Does Water move and fight differently from Bomber?
- Do Pyro, Mech, Frost, Volt, Thorn and Void have recognizable movement languages?
- Are body, core, weapon, aura and effects readable at the current scale?
- Which fighter is most/least visually appealing?

## 5. AI and player control

- Does the AI make sensible use of distance and skills?
- Does it become repetitive or get stuck?
- Is player steering responsive enough?
- Are aiming and touch/keyboard controls clear?
- Does camera follow or shake interfere with control?

## 6. Arenas and modes

Test compact and large arenas, environmental hazards, Duel, Team Battle, Battle Royale, Boss Raid, Survival and Mass Skirmish.

- Do the arenas genuinely change how battles unfold?
- Are mode/arena restrictions sensible?
- Are objectives and winners clear?
- Do hazards communicate their effect before damage occurs?

## 7. Progression and Fighter Lab

- Are unlock requirements understandable and rewarding?
- Is profile/history/loadout behavior useful?
- Can you create a fighter without becoming confused by the editor?
- Does a custom fighter look and behave as expected after saving?

## 8. Sound and impact

- Are small, medium and major impacts distinguishable?
- Are explosions satisfying or noisy?
- Can you identify ability families from sound?
- Does large-battle audio become cluttered?

## 9. Performance and accessibility

- Test Standard, Minimal and Debug render profiles.
- Test Battery, Balanced and High presets.
- Test reduced motion, no shake, no flashes and effects off.
- Note FPS drops, stutters, memory growth, input lag or crashes.

## 10. Bugs

For reproducible bugs, include:

```text
Version: 1.0
Seed:
Arena:
Mode:
Fighter A / Fighter B:
Controllers:
What happened:
What you expected:
```

Using **Replay same battle** preserves the seed and is useful for confirming a bug.
