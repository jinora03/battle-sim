# v1.1 Stage 6 — Layered VFX and Combat Feedback

Stage 6 is implemented on top of the complete Stage 8 build. It preserves the deterministic simulation, Stage 3 weapons, Stage 4 camera/player controls, Stage 5 Ability Lab and Stage 8 mobile rendering/lifecycle work.

Stage 6 changes presentation only. It does not alter damage, cooldowns, hit detection, projectile paths, AI decisions, RNG or match results.

## Goals

- Make attacks read as weapon-specific actions instead of generic flashes.
- Separate persistent arena effects from fighter-, weapon-, projectile- and screen-relative effects.
- Add residual impact detail without allocating new Pixi objects during every hit.
- Keep visual radius independent from gameplay radius.
- Scale VFX by device/performance pressure while preserving gameplay truth.
- Improve impact weight through coordinated flashes, trails, shake and hit-stop.

## Layer hierarchy

The Pixi world now uses explicit effect anchors:

```text
Arena geometry
Arena-relative ground FX
Fighter movement trails
Projectile-relative trails
Projectiles
Skill telegraphs
Fighter-relative aura/status FX
Fighters
Weapon-relative attack FX
World-fixed sparks/smoke/debris/shockwaves
Training debug and combat text
Screen-relative flash/recovery UI
```

Camera fitting, player follow and shake remain separate transforms. Ground marks and world impacts therefore stay attached to the arena instead of drifting with a fighter.

## Weapon-specific effects

Every Stage 3 weapon has a reusable VFX recipe:

- **Ember Sword** — fire slash, embers and scorch marks
- **Tidal Spear** — directional thrust, droplets and wet marks
- **Steel Hammer** — heavy arc, debris and floor cracks
- **Demolition Bomb** — lob trail, smoke, blast debris and scorch marks
- **Cryo Axe** — spinning ice trail, shards and frost marks
- **Arc Rifle** — muzzle flash, beam-like projectile trail and electric impact
- **Thorn Claws** — rotating nature trail and organic debris
- **Void Orbit Blade** — orbit trail, void sparks and residual void marks

The recipe describes presentation only. Weapon range, hit arc, damage and projectile behavior still come from authoritative content/simulation data.

## Fighter-relative feedback

- Element-colored ambient glow at high quality
- Status rings for Burn, Wet, Frozen, Shocked, Rooted, Void Mark and defensive states
- Core hit pulses attached to the damaged fighter
- Existing cast motion, weapon pose and victory presentation retained

These visuals follow the fighter but do not modify its collider or gameplay radius.

## Projectile-relative feedback

Projectiles maintain short pooled history trails. Trail color and shape are selected by weapon recipe. Trail sample budgets scale by VFX tier and can still be disabled with the existing Trails setting.

The actual projectile position remains simulation-owned; the renderer only interpolates snapshots.

## Arena-relative feedback

Stage 6 adds pooled, fading ground marks:

- scorch
- frost
- cracks
- wet residue
- void residue

Marks are produced by weapon hits, blasts, wall impacts, obstacle destruction and deaths. Their maximum count is capped by VFX quality, and old marks are recycled instead of growing without bound.

Elemental arena zones also receive restrained ambient outlines at medium/high VFX quality.

## Residual particles

A dedicated pool adds longer-lived:

- sparks
- smoke
- debris
- embers
- droplets
- ice shards

The earlier immediate-impact pool remains in place for flashes, shockwaves and fast bursts. Stage 6 residual particles are layered separately and use a fixed pool, so hits do not create new Pixi nodes at runtime.

## VFX quality tiers

Stage 6 derives one presentation-only tier:

- **High** — full particle/residual density, longer trails, more ground marks and full feedback multipliers
- **Medium** — reduced residual density, shorter trails and smaller persistent budgets
- **Low** — minimal residuals, short trails, fewer marks and reduced shake/flash/freeze intensity

Tier selection considers:

- Effects enabled state
- Particle density setting
- Reduced Motion
- Adaptive Quality
- Current presentation performance scale
- Fighter count

No tier changes simulation behavior.

## Visual radius boundary

`resolveVisualRadius()` deliberately separates authored visual size from gameplay radius. An ultimate shockwave may render larger than its damage radius for readability, while ambient effects may render smaller on constrained devices. Collision and damage continue to use simulation/content values only.

## Diagnostics

Developer metrics now include:

- VFX quality tier
- active ground marks
- active residual particles
- active weapon effects
- active projectile trails
- combined active particle count

The Ability Lab exposes the VFX tier and persistent-effect counts alongside its existing deterministic diagnostics.

## Main implementation areas

- `packages/visual-engine/src/vfx.ts`
- `packages/visual-engine/src/index.ts`
- `packages/renderer-pixi/src/layeredVfx.ts`
- `packages/renderer-pixi/src/index.ts`
- `apps/game/src/App.tsx`
- `apps/game/src/TrainingLabView.tsx`
- `tests/stage6-layered-vfx.test.ts`
- `validation/v1.1-stage6-vfx.ts`

## Boundaries

Stage 6 does not add final authored sprite sheets, external texture atlases, professional sound libraries or GPU shaders. Current effects remain procedural Pixi graphics designed to prove the architecture and combat-feedback direction.

Stage 7 large-battle profiling and optimization remains the next unfinished roadmap stage.
