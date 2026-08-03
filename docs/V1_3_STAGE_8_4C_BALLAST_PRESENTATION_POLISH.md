# Kinetic Battle Engine v1.3.4 — Stage 8.4C Ballast Presentation Polish

Stage 8.4C completes Ballast's first presentation pass without changing his simulation behavior, damage, cooldowns, mass multipliers, AI decisions or deterministic step order.

## Dedicated resolve styles

Ballast no longer borrows presentation identities from unrelated fighters:

- `Featherfall` uses `mass-bloom`: layered weightless rings and drifting violet/cyan particles.
- `Downbeat` uses `downbeat-punt`: a directional double burst and compact pressure ring.
- `Dead Weight` uses `anchor-drop`: dense dark/cyan impact rings and weighted fragments.
- `Last Call` uses `last-call`: a large void inversion flash, three mass rings and two particle layers.

The styles remain generic renderer recipes selected through `@kinetic/visual-engine`; no new simulation-side fighter branching was added.

## Dedicated synthesized audio

The browser audio engine now recognizes:

- `skip-stone` attack start, launch and impact
- `featherfall`
- `downbeat`
- `dead-weight`
- `last-call`

The cues use the existing Web Audio synthesis path and event budget. No external sound assets or new runtime dependencies are required.

## Compatibility

- Engine/content version: `1.3.4-stage8.4c`
- Replay schema: unchanged
- Checksum inputs: unchanged
- Ballast gameplay and balance: unchanged
- Existing fighters: unchanged
