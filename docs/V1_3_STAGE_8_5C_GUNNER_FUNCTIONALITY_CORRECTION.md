# Kinetic Battle Engine v1.3.7 — Stage 8.5C Gunner Functionality Correction

Stage 8.5C corrects two live-play readability and reliability problems discovered after Stage 8.5B.

## Kill Zone

- Removes the precomputed ten-degree fan that caused rounds to curve away from the selected target.
- Delayed gatling rounds now re-aim at the selected target at their individual launch ticks.
- Rounds travel as straight ballistic bullets after launch; no homing arcs.
- Retains 24 rounds at two-tick intervals and the Stage 8.5B damage budget.

## Suppressive Burst

- Changes from a wide 22-degree six-round fan to a six-round tracked firing lane.
- Extends Suppressed to 78 ticks and strengthens its movement reduction to 0.70x.
- Keeps individual round damage unchanged, improving reliability rather than per-hit burst damage.

## Generic foundation

`LAUNCH_PROJECTILES` gains optional `retargetEachLaunch`. Delayed rounds using it deterministically recompute their initial direction toward the still-living selected target when each round launches. Existing abilities default to snapshot aiming and remain unchanged.
