# Stage 8.9A — Round-Screen and Near-Square UI

Stage 8.9A adds a dedicated compact-shape presentation profile for Galaxy Watch-class browsers and other small near-square viewports. It does not make the Pixi arena circular. Instead, it gives Battle and Ability Lab stable square renderer hosts and moves critical UI into the square that remains visible inside a circular bezel.

## Architecture

- `@kinetic/platform` classifies viewports as `rectangular`, `near-square`, or `round`.
- True round displays use the `(shape: round)` media feature when available.
- Browsers without that feature fall back to a deterministic near-square check limited to viewports no larger than 560 px.
- `AppController` publishes the result through `data-display-shape` and refreshes it with the existing viewport lifecycle.
- The styling is separated into shell, Battle, and Ability Lab files so watch-specific rules do not accumulate in the legacy global stylesheet.

## User-facing changes

- navigation, drawers, notifications, and app padding remain inside the circular safe region;
- Battle and Ability Lab renderer hosts retain a non-zero, square CSS box during round-screen layout changes;
- Battle objective copy, match intro portraits, touch movement, and skill controls scale down without disappearing;
- nonessential battle diagnostics move below the priority experience or are suppressed on watch-sized screens;
- normal portrait phones, landscape phones, tablets, and desktop layouts keep their existing behavior.

## Explicit non-goals

- no circular simulation arena;
- no physics, AI, balance, replay, audio, or combat-VFX changes;
- no special fighter behavior for watch devices.
