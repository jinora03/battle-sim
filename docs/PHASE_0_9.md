# Phase 0.9 — Mobile Readiness, Accessibility & Release Candidate Hardening

## Objective

Turn the working engine/game lab into a device-aware application shell without allowing device performance or accessibility choices to alter gameplay truth.

## Platform/settings boundary

`@kinetic/platform` owns:

- device capability detection
- quality preset recommendation
- versioned application settings
- settings normalization/migration
- conversion into presentation-only settings

It does not import or mutate simulation state.

```text
AppSettings
├── qualityPreset
├── render target
├── pixel-ratio limit
├── particle density
├── adaptive quality
├── render/FX/audio preferences
└── accessibility/UI preferences
             ↓
PresentationSettings
             ↓
Renderer + Audio + Browser Runtime
```

## Quality presets

### Auto

Resolves at application startup using coarse-pointer/mobile detection, logical CPU count, optional device memory, data-saver state, and the OS reduced-motion preference.

### Battery saver

- 30 FPS presentation target
- minimal character rendering
- 1× device pixel ratio
- low particle density
- no trails, camera shake, screen flashes, or presentation hit freeze
- adaptive quality enabled

### Balanced

- 60 FPS target
- standard rendering
- 1.5× pixel-ratio cap
- moderate particles
- adaptive quality enabled

### High quality

- 60 FPS target
- standard rendering
- up to 2× pixel ratio
- full particle density
- adaptive lowering disabled unless the user enables it manually

### Custom

Any granular change moves the selector to Custom while preserving the exact values.

## Adaptive quality governor

The browser runtime measures simulation and render work against the chosen rendering budget. Sustained expensive frames lower a presentation-only scale in small steps. Sustained headroom restores it slowly.

The scale affects:

- particle density
- automatic fighter LOD
- trail sampling

It never affects:

- fixed simulation tick rate
- AI
- hit detection
- damage
- cooldowns
- RNG sequence
- winner or replay checksum

## 30/60 FPS decoupling

The requestAnimationFrame loop always services fixed-step simulation updates. Rendering may occur every ~16.7 ms or ~33.3 ms. Simulation events are buffered until the next rendered frame so FX are not discarded when using 30 FPS mode.

Audio consumes semantic events from simulation independently of render cadence.

## Accessibility

Reduced-motion mode disables or suppresses:

- camera shake
- presentation impact freeze
- screen flashes
- exaggerated procedural squash/stretch and cast jitter
- camera zoom emphasis

High contrast changes the application shell only. Large touch controls expand directional/skill control targets. These settings persist locally.

## Mobile lifecycle

When document visibility changes away from `visible`, the runtime pauses and clears held player movement. Returning to the app resets timing, preventing a large simulation catch-up or accidental movement.

## Responsive shell

- `env(safe-area-inset-*)` spacing
- portrait single-column layout
- sticky horizontally scrollable application tabs
- compact touch battle overlay
- landscape phone battle-only layout
- fullscreen arena support
- `touch-action: none` on the interactive arena

## Release recovery

- renderer boot overlay
- recoverable renderer error state
- React error boundary
- display-settings reset action
- PWA manifest/icon metadata
- Capacitor background configuration and sync/open scripts

## Deliberate limitations

This phase does not claim final store readiness. It does not generate native launcher assets, install platform SDKs, sign builds, submit to stores, or prove performance across a physical-device matrix. Those require the user's local Android/iOS toolchains and real hardware.
