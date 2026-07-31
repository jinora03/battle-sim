# Kinetic Battle Engine v1.1 — Stage 7.4 Combat Polish Hotfix

This hotfix finishes the unresolved Stage 7.4 combat presentation and physics work without changing the project architecture.

## Rocket cascade freeze

- Guided Rocket, Rocket Salvo, Siege Missile and Micro Missile impacts are classified as missile cascades.
- Missile weapon hits, blast events and ability-resolution events apply no hit-stop.
- The renderer keeps a short 240 ms suppression window after any missile-cascade event so related body impacts, wall impacts and deaths on adjacent frames cannot repeatedly freeze the arena.
- Camera shake, blast flashes, particles, damage and knockback remain active.

## Weapon centering

- The weapon socket is now at the fighter's local origin (`0, 0`).
- Weapon recoil and attack animation move away from this centered resting point instead of starting offset toward the edge of the body.

## Damage-scaled explosion knockback

- Explosion force now scales nonlinearly with explosion damage.
- External blast momentum is stored separately from locomotion, so AI movement or `stop` commands do not erase it.
- Multiple explosions may stack momentum up to a safe cap.
- Arena and obstacle collisions reflect the external impulse, allowing genuine wall bounces.
- Bomber's Mega Bomb produces much stronger launch force than small missiles.

## Bomber cadence

- Impact Bomb basic attack cooldown changed from 46 ticks to 70 ticks, matching Guided Rocket's basic attack interval.

## Gunner presentation

- Automatic Rifle no longer draws a full-range beam at burst start.
- Every bullet produces its own centered muzzle flash, recoil pulse and short-lived tracer.
- The tracer is shorter and warmer so it reads as a bullet rather than a laser tether.
- Rifle impacts have stronger target flashes, sparks and a separate impact sound.
- Rifle audio layers a sharp crack, low body, mechanical action and bolt click while retaining a subtle sci-fi character.

## Validation performed without dependency installation

- `node scripts/lint.mjs` passed.
- Modified TypeScript packages passed an install-free static type pass using temporary declarations outside the project.
- A deterministic simulation regression confirmed Mega Bomb emitted `knockbackApplied`, moved the target into the arena wall, emitted `wallImpact`, and bounced it back.
- No `npm install` was run and no `node_modules` directory is included.

After extracting, run:

```bash
npm install
npm run check
```
