# v1.3.24 Stage 8.8D — Settings and Metrics Organization

Stage 8.8D reorganizes the long Battle Setup settings and developer diagnostics panels without changing their underlying values or runtime behavior.

## Settings organization

The settings panel now uses reusable stateful disclosure groups:

- Rendering — quality preset, visual style, FPS target, render scale, DPR cap, adaptive quality
- Effects — particle density, telegraphs, attachments, health rings, damage numbers, intros, arena background, trails
- Camera — camera shake, camera follow, fullscreen
- Accessibility — impact freeze, screen flashes, reduced motion, high contrast
- Audio — master volume and audio enablement
- Developer — detailed metrics panel visibility

Touch control mode, control opacity, large touch controls, movement mode and aim assist remain together in Player Controls.

Rendering, Effects and Audio begin expanded. Less frequently changed groups remain collapsed, and each group retains its own open state while settings update.

## Metrics organization

The developer panel keeps the live FPS tile and groups the remaining diagnostics into:

- Rendering — frame pacing, adaptive quality and canvas/viewport state
- Simulation — tick health and runtime timing
- Controllers — AI workload, player input and sampled AI decisions
- Physics — broadphase, projectile/obstacle checks and contacts
- Presentation — renderer views, VFX and audio voices
- Replay — checksum, command storage and compression

Rendering and Simulation begin expanded. Other diagnostic domains are available without presenting one uninterrupted wall of metrics.

## Compatibility

No setting keys, defaults, simulation values, diagnostics values, gameplay behavior or replay behavior changed.
