# Kinetic Neon UI System

## Semantic tones

- `success`: start, confirm, resume and fire
- `random`: randomize, generate, import and creative actions
- `pause`: pausing and attention-required temporary states
- `danger`: reset, delete and destructive actions
- `utility`: replay, export, fullscreen and technical controls
- `ghost`: low-emphasis navigation and setup actions
- `ultimate`: ultimate-ability emphasis

## Reusable primitives

`apps/game/src/ui/NeonUI.tsx` exports:

- `NeonButton`
- `AppNavigation`
- `DrawerScrim`
- `DrawerHeader`
- `PanelTitle`
- `GlassSurface`

## Responsive model

Desktop keeps the arena in the center with sticky setup and diagnostics. At 900px and below, setup panels become left-side drawers and important controls move to a touch-safe fixed dock above the bottom navigation. Ability Lab uses the same pattern.

## Accessibility

The theme includes visible `:focus-visible` treatment, 42px touch targets, semantic `aria-current`, `aria-expanded`, drawer labels, Escape-to-close behavior, high-contrast overrides and reduced-motion overrides.

## Performance

The UI animations affect presentation only. Reduced-motion mode collapses animation and transition durations. Mobile uses controlled blur density and avoids changing simulation, AI, physics, damage or renderer resolution logic.
