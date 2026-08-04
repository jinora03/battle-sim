# Kinetic Battle Engine v1.3.11 — Stage 8.6C-2A

## Seeded Opening Readiness and Controlled AI Variation

Stage 8.6C-1 correctly removed Solar Sentinel's impossible Heat requirement, but that exposed a broader AI-opening problem: every ready ability was evaluated from tick zero, so a long-range ultimate with the highest utility could be selected immediately in almost every seed.

Stage 8.6C-2A introduces a reusable AI opening cadence without adding nondeterministic randomness or changing the simulation RNG stream.

## Opening windows

At 60 simulation ticks per second:

| Ability class | Seeded first-use window |
| --- | ---: |
| Basic attack | immediately available |
| Movement skill | 18–60 ticks (0.3–1.0 s) |
| Normal skill | 30–120 ticks (0.5–2.0 s) |
| Skill 3 payoff | 90–210 ticks (1.5–3.5 s) |
| Ultimate | 300–480 ticks (5.0–8.0 s) |

The exact ready tick is derived from the battle seed, entity id, ability id, slot and intent. It does not consume `SeededRng`, so spawn placement and other simulation-random sequences are not shifted.

## Controlled decision variation

Each ability receives a small deterministic utility adjustment capped at ±3.25 score points. This is intentionally too small to make an obviously bad action beat a clearly superior one, but it can change the ordering of otherwise close choices.

The variation epoch advances only after the fighter commits an ability. It does not reroll every tick while the AI is waiting, moving or firing its basic attack.

## Solar Sentinel result

Solar Eye Beams remains fully usable and retains its real range and priority, but it can no longer be selected during the first five seconds of a battle. Depending on the seed, its first opening occurs between five and eight seconds.

## Determinism guarantees

- Same seed, roster and commands produce the same opening delays and AI choices.
- Different seeds can produce different opening sequences.
- No `Math.random()` calls were added.
- Replay recording requires no schema change because the AI still emits ordinary deterministic commands.
- Player-controlled abilities are unaffected; opening readiness is an AI decision policy rather than a simulation-wide cooldown.
