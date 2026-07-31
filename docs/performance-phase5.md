# Stage 7.4 Performance Phase 5 — Mass-battle presentation

Phase 5 keeps simulation and deterministic outcomes unchanged while reducing presentation work as fighter counts rise.

## Render policy

- Fewer than 40 fighters: requested render rate, full presentation budget.
- 40–79 fighters: crowd tier, up to 45 FPS, bounded events and projectiles.
- 80 or more fighters: mass tier, 30 FPS rendering while simulation remains fixed at 60 Hz.

Critical events, player-related feedback, deaths, ultimates and battle results are prioritized. Projectile visuals and trails are sampled deterministically; projectile simulation is not removed.

## Renderer boot reliability

The battle renderer no longer initializes while the Fight workspace is hidden offscreen. It waits for the Fight view to receive a visible layout, then initializes PixiJS. Battle requests made during startup are queued and applied after initialization.
