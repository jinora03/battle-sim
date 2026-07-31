# Stage 7.4 performance phase 6

This pass targets the main-thread stalls visible in the 50-fighter profiling capture.

- Large-battle diagnostics publish at 1 Hz instead of 2 Hz.
- Achievement evaluation batches events while preserving all event-driven checks.
- Browser viewport state updates are ignored when values did not change.
- Pixi resize requests no longer resize an unchanged canvas.
- Mass presentation begins at 48 fighters and renders at a stable 30 FPS while simulation remains 60 Hz.
- Mass VFX uses hard residual, weapon, ground-mark, projectile and event budgets.
- AI-vs-AI damage has a dedicated audible hitmarker cue.

The pass does not change physics, AI decisions, damage or deterministic battle results.
