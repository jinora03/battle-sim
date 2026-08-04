# Kinetic Battle Engine v1.3.5 — Stage 8.5A Gunner Readability

Stage 8.5A begins Gunner's identity pass with a narrow behavior and presentation adjustment. It deliberately preserves the existing four-round Automatic Rifle, Target Lock passive, Tactical Slide, Suppressive Burst, Pinning Round, Kill Zone and all six modules.

## Behavior changes

- `ranged-gunner` now prefers a 440-unit firing lane, is less likely to over-commit forward and uses stronger lateral kite steering.
- Committed burst-style primaries brace and strafe through windup/active phases instead of continuing to surge toward the target between rounds.
- Each unlaunched round refreshes its direction toward the selected living target. Projectiles already in flight remain unchanged.
- Tactical Slide remains the emergency close-range reposition tool and receives higher AI priority only inside 230 units.

## Presentation changes

- Automatic Rifle, Tactical Round and Suppressive Round produce no per-hit freeze. Pinning Round keeps its heavier impact pause.
- Rapid rounds use smaller flashes, fewer shards and no repeated camera shake.
- Tactical, suppressive and pinning projectiles now have explicit ballistic VFX recipes rather than the generic fallback.
- All Gunner rifle projectiles use the rifle crack family; Pinning Round receives a heavier layered report.
- The attack-start cue is a mechanical commit rather than an extra fifth gunshot.
- Gunner's visible rifle now includes an outlined stock, receiver, scope, magazine, long barrel and muzzle brake, plus repeated four-round recoil pulses.

## Compatibility

- Engine/content marker: `1.3.5-stage8.5a`
- Replay schema is unchanged.
- Simulation tick order is unchanged.
- Burst count, damage, cooldown, projectile speed, Target Lock behavior and skill definitions are unchanged.
