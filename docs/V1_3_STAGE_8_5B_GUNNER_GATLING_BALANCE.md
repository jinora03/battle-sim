# Kinetic Battle Engine v1.3.6 — Stage 8.5B Gunner Gatling and Balance

Stage 8.5B replaces Gunner's missile-based Kill Zone with a sustained rotary-gun barrage and reduces his opening damage without changing his four-round rifle identity.

## Kill Zone

- Launches 24 `kill-zone-round` rifle bullets at two-tick intervals.
- Stage 8.5C later replaces this fan with a per-round tracked straight firing lane.
- Produces no explosions, smoke trails or missile cascade behavior.
- Applies a short `kill-zone-overdrive` presentation status for the temporary rotating-barrel rig.

## Balance

- Automatic Rifle: 3.4 → 2.8 damage per round.
- Automatic Rifle cooldown: 34 → 38 ticks.
- Suppressive Round: 2.7 → 2.25 damage.
- Pinning Round: 10 → 9 base damage; Target Lock bonus 4.2 → 3.2 per stack.
- Kill Zone base direct budget: 37.2 damage if all 24 rounds connect, before its small Target Lock bonus.
- Kill Zone cooldown: 600 → 660 ticks.

## Presentation

- Gunner projectiles use an elongated brass bullet body with a copper tip and tracer.
- Kill Zone displays a temporary rotating five-barrel weapon rig.
- The stable `shoulder-missile-pod` module id is retained for compatibility, but its display identity is now Rotary Ammo Drum.
- Tactical Slide, Suppressive Burst, Pinning Round and Kill Zone receive layered intent-specific synthesized cues.
- Kill Zone borrows Thunder Dome's satisfying charge/resolve layering philosophy, but uses motor spool, mechanical ratchet and rotary-fire tones rather than electricity.
