# Stage 8 Device QA Matrix

Use this checklist after `npm install`, `npm run check` and `npm run dev`.

## Browser emulation

Test at minimum:

| Profile | Suggested viewport | Orientation |
|---|---:|---|
| Small phone | 375 × 667 | portrait and landscape |
| Modern phone | 393 × 852 | portrait and landscape |
| Large Android | 412 × 915 | portrait and landscape |
| Small tablet | 768 × 1024 | portrait and landscape |
| Desktop | 1366 × 768 | landscape |
| Wide desktop | 1920 × 1080 | landscape |

For each profile:

1. Open Home, Battle Lab and Ability Lab.
2. Confirm the arena is centered and not clipped.
3. Confirm touch controls do not cover the arena or skill activity.
4. Rotate repeatedly while a battle and projectile are active.
5. Open and close Battle Setup, Developer, Performance and Simulation Metrics.
6. Toggle fullscreen and exit fullscreen.
7. Verify CSS canvas size and internal pixel size in the debug readout.
8. Change Battery, Balanced and High presets and confirm internal resolution changes without restarting the battle.
9. Set render scale and DPR cap manually under Custom quality.
10. Confirm simulation tick behavior and battle result remain unchanged by quality settings.

## Real Android device

- Chrome portrait and landscape
- address bar expanded and collapsed
- home-screen/standalone install if available
- app background/foreground during battle
- lock/unlock during battle
- audio resume after returning
- touch movement plus simultaneous skill activation
- Battery preset heat and battery behavior
- Balanced preset readability
- 20v20 Mass Skirmish responsiveness
- renderer recovery screen after an actual or forced graphics interruption where available

## Real iOS/iPadOS device

- Safari portrait and landscape
- notch/Dynamic Island safe areas
- bottom home-indicator safe area
- browser chrome expansion/collapse
- Add to Home Screen / standalone mode
- background/foreground and lock/unlock
- first-interaction audio unlock and later resume
- touch controls with multiple fingers
- fullscreen-like standalone layout
- arena sharpness at DPR cap 1.25, 1.75 and 2.0

## Desktop regression

- Touch controls remain hidden in Auto mode on a normal mouse/keyboard desktop.
- Always show and Always hide still override detection.
- Mouse aim remains correct after resize, zoom, fullscreen and camera follow.
- Opening developer panels does not throw a null `.open` error.
- Canvas does not multiply after navigating repeatedly between Battle Lab and Ability Lab.
- Returning from another main view resumes only the intended runtime.

## Pass criteria

Stage 8 is ready for the next pass when:

- no layout loses the primary battle controls;
- no rotation leaves the arena permanently offset or blank;
- the canvas pixel dimensions match the displayed diagnostics;
- repeated resize/orientation changes do not create a loop or growing canvas count;
- backgrounding stops unnecessary animation/audio work;
- restoring does not reset deterministic battle state;
- Battery mode remains readable;
- High mode does not exceed the configured DPR cap;
- no quality setting alters simulation results.
