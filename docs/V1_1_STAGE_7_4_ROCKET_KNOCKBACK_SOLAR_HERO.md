# v1.1 Stage 7.4 — Rocket, Knockback, and Solar Hero Fix

## Rocket barrages

- Missile simulation remains fully deterministic and applies every damage/physics event.
- Explosive projectile direct-hit and blast payloads are merged to avoid duplicate damage/hit/knockback event floods.
- Multi-rocket skills launch one missile at a time instead of spawning the whole barrage on one simulation tick (Salvo/Siege: 5-tick spacing; Starburst: 3-tick spacing).
- Rendering keeps up to three launch cues but combines same-frame missile impacts into one damage, knockback, and blast presentation.
- Missile hit-stop remains disabled through missile-caused secondary collisions.

## Gunner rollback

- Removed the imported reference audio asset and the custom cyan reference effects.
- Restored the original procedural rifle crack, projectile drawing, muzzle feedback, hit feedback, and simple recoil.
- Kept the centered weapon pivot and 3.6 damage tuning.

## Explosion movement

- Explosion momentum has persistent retention independent of walking speed.
- Mega Bomb uses a 72-unit impulse cap, 0.997 retention, and preserves wall restitution until three bounces occur.
- Knockback creates bright fighter motion trails that refresh on wall and obstacle impacts.

## Solar Sentinel

A legally distinct solar-powered flying powerhouse was added with:

1. Solar Punch
2. Sky Rush
3. Thunder Clap
4. Solar Aegis
5. Solar Beam (directional laser ultimate)
