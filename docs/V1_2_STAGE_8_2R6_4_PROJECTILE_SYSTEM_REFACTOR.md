# Stage 8.2R6.4 — Projectile System Refactor

## Goal

Reduce `packages/simulation/src/runner.ts` by moving projectile lifecycle and
impact behavior into a focused simulation system without changing deterministic
combat output.

## Extracted responsibility

The projectile feature is split into three focused files:

- `ProjectileSystem.ts` — lifecycle, collision routing and impacts;
- `ProjectileSystemTypes.ts` — state and callback contracts;
- `ProjectileGeometry.ts` — deterministic segment and steering helpers.

Together they now own:

- projectile state and stable projectile IDs;
- delayed projectile-launch scheduling;
- projectile spawn offsets, spread and module modifiers;
- movement, lifetime and fuse countdown;
- homing target acquisition and steering;
- spatial-hash entity candidate queries;
- obstacle and arena-bound collision checks;
- wall and obstacle ricochet behavior;
- penetration and duplicate-target prevention;
- direct-hit resolution routing;
- explosion-area candidate routing;
- projectile impact, weapon-hit and blast presentation events;
- dead-projectile compaction;
- invalid numeric projectile recovery.

Damage, statuses, passive activation and knockback remain authoritative runner
operations. The projectile system reaches them only through narrow callbacks,
so it cannot bypass the existing combat rules or training-mode behavior.

## Runner responsibility after extraction

`LocalSimulationRunner` still owns:

- simulation tick ordering;
- ability action selection and projectile pattern/target selection;
- primary weapon attack phases;
- authoritative damage and status application;
- passive execution;
- knockback and protected wall-bounce behavior;
- battle state and result finalization.

## Determinism

The refactor preserves the original order of:

1. delayed projectile launches;
2. command processing;
3. movement and spatial-index rebuild;
4. projectile updates;
5. arena and entity collision processing.

Projectile candidate IDs remain sorted by entity ID before hit resolution, and
pending launches remain sorted by launch tick and stable sequence number.

## Size result

- `runner.ts`: approximately 1,820 lines before R6.4
- `runner.ts`: approximately 1,437 lines after R6.4
- largest extracted projectile file: approximately 720 lines

## Validation scenarios

Before-and-after JSON output matched exactly for:

- Gunner Ricochet Chamber wall reflection;
- Gunner Piercing Barrel multi-target penetration;
- Rocket Vanguard delayed sixteen-missile ultimate;
- Bomber ultimate explosion and protected wall impacts;
- a full AI Rocket Vanguard versus Gunner projectile-heavy duel.

The comparison included final checksums, ticks, results, metrics, entity state,
projectile state, full projectile/damage event sequences and event counts.
