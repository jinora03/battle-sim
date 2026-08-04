# Kinetic Battle Engine v1.3.20 — Stage 8.7D

## Battle Readability, Ranged Anti-Stall, and Roster UX Polish

Stage 8.7D closes the Stage 8.7 presentation milestone with a combined visual-readability, deterministic AI-stability, and roster-interface pass.

The phase addresses four concrete issues observed during live testing:

1. Profile-driven particles often looked like soft floating bubbles because too many effects reused circular sprites.
2. Important attacks needed clearer layered glow similar to the match-preparation presentation, without making every basic attack equally bright.
3. Two ranged fighters could preserve distance into opposite corners and remain in an unproductive endgame loop.
4. Roster cards stretched inconsistently, and long passive/module descriptions made the tab difficult to scan.

## 1. Intent-specific particle vocabulary

The reusable VFX system now supports additional angular and directional particle shapes:

- `streak`
- `arc`
- `ring-fragment`
- `flame`
- `wedge`
- `ribbon`

Existing shapes such as sparks, embers, debris, shards, smoke, and droplets remain available.

`resolveCombatVfxParticleStyle()` maps the visual intent and element palette to a primary and secondary particle language. Examples:

- Explosion: debris, smoke, flame, shards, or broken ring fragments.
- Pull: inward ribbons and curved ring fragments.
- Directional knockback: wedges and force streaks.
- Beam/projectile/dash: narrow streaks, electric arcs, sparks, or embers.
- Transformation/status/channel: palette-specific combinations rather than one generic circular burst.

This mapping is used by both the full Pixi effect engine and the budgeted layered renderer.

## 2. Layered glow and broken shockwaves

Major profiled effects now use a reusable layered bloom:

1. soft outer glow
2. medium halo
3. bright core
4. white-hot center/rim accents

The existing hierarchy still controls intensity:

`basic < skill < payoff < ultimate`

Explosions and radial pressure releases can also use broken shock rings made from segmented arcs. These read as kinetic shockwaves rather than large translucent bubbles.

The mass-battle renderer receives simplified versions of the same shape and glow language, so low-quality mode remains readable instead of losing the effect completely.

## 3. Deterministic ranged corner escape

The AI controller now tracks consecutive corner-pressure reactions for ranged fighters.

Eligible primary-attack behaviors are:

- ranged
- automatic
- throwable
- beam

Kiting profiles without a primary-attack definition are also eligible.

When a ranged fighter remains near both a horizontal and vertical arena boundary for two AI reactions, it temporarily enters a corner-escape state. The escape vector:

- always contains a strong component toward the arena interior;
- blends a lateral route around the target rather than charging straight through it;
- uses a stable seed/entity/target/epoch tie-break when two lateral routes are similarly useful;
- expires after a bounded escape window, allowing the fighter to resume its normal spacing profile.

No `Math.random()` or simulation RNG call was added. The same seed produces the same escape route and command trace. Different seeds may choose different equivalent lateral routes.

This is an intentional AI movement change, so final battle checksums can differ from Stage 8.7C-3 in matches where the corner-escape condition occurs. Replay determinism within Stage 8.7D remains intact.

Player-controlled movement is not routed through this state.

## 4. Roster layout consistency

Roster cards now use explicit grid rows for:

1. portrait and identity
2. statistics
3. ability cards
4. passive/modules information
5. actions

The roster grid aligns cards at the top instead of stretching a shorter fighter card to match a taller neighbor. Portraits, statistics, skills, disclosures, and actions therefore occupy the same structural positions across simple and complex fighters.

## 5. Collapsible passive and module information

The passive and approved-module sections now use native disclosure controls.

- Short passive descriptions open by default.
- Long passives may start collapsed.
- Approved modules are collapsed by default.
- The module summary includes the compatible-module count.
- Expanded modules are displayed as compact chips instead of one dense paragraph.
- Mobile layout resets the desktop grid placement cleanly.

## Compatibility and scope

Version markers advance together to `1.3.20-stage8.7d`.

This phase does not change:

- fighter damage
- health
- cooldowns
- ability ranges
- status values
- physics constants
- projectile behavior
- player input

The ranged corner-escape rule changes AI movement only when its deterministic anti-stall condition is met.

## Manual verification checklist

### Battle readability

- Confirm explosions contain debris/rings/smoke rather than only circular dots.
- Confirm Fire uses flame/ember shapes and Electric uses arcs/streaks.
- Confirm Polarity Pull and Fire Vortex visibly compress particles inward.
- Confirm directional punts show wedges/streaks while radial knockback uses broken rings.
- Confirm ultimates have stronger bloom than normal skills without hiding health bars.
- Confirm low-quality and 41+ fighter modes retain simplified readable effects.

### Ranged anti-stall

- Run multiple ranged-versus-ranged duels.
- Let both fighters reach corners near the end of a match.
- Confirm a cornered fighter moves inward/laterally, clears the corner, and resumes ranged spacing.
- Replay the same seed and confirm the escape direction/timing repeats.
- Use a different seed and confirm equivalent lateral routes can vary.

### Roster

- Compare Pyro and Mech Bruiser side by side.
- Confirm both cards align their portrait, stats, skills, information, and actions consistently.
- Confirm approved modules begin collapsed.
- Confirm passive and module disclosures expand without stretching the neighboring card.
- Confirm the layout remains usable on narrow/mobile viewports.
