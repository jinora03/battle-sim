# Stage 7.4 Performance Phase 1

This pass measures the browser runtime before changing AI decisions, physics, damage, or fighter behavior.

## 50v50 profiling procedure

1. Open **Fight** and configure a 50v50 mass skirmish in **War Basin**.
2. Open **Developer metrics panel**. Detailed timing is collected only while this panel is open.
3. Let the battle run for at least 20 seconds after the first major engagement.
4. Record these values:
   - Simulation total
   - AI
   - Simulation core
   - Replay record
   - Post simulation
   - Diagnostics/UI prep
   - Render p95
   - Frame p95
   - Dropped simulation ticks
   - Replay commands
   - Active particles and projectile trails
5. Repeat once with the **Balanced** preset and once with **Battery saver**.

## How to interpret the result

- **AI is largest:** stagger decision updates and add spatial AI queries next.
- **Simulation core is largest:** inspect collision, projectile, zone and snapshot construction costs.
- **Replay record is large:** compress or disable unchanged movement commands for mass battles.
- **Post simulation is large:** reduce per-tick stats, achievement and event-processing work.
- **Render p95 is largest:** tighten mass-battle particle, trail and fighter-detail budgets.
- **Diagnostics/UI prep is large:** further reduce React payloads and panel-only calculations.

The first comparison should use the same fighters, arena, mode and seed so the workload remains comparable.
