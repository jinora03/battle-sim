# v1.1 Stage 7.1 — Gameplay AI, Fighter Weapons and Crowd Performance

Stage 7.1 is an iteration on the complete Stage 7 build. It addresses gameplay cadence, target-facing presentation, player aiming, Fighter Lab weapon authoring and the excessive visual work visible in 50v50 battles.

## AI combat cadence

- Every equipped ability slot is considered when the fighter is free to attack.
- Ready skills receive deterministic priority based on intent, range, target count, health and configured priority.
- The Basic slot is the reliable fallback whenever no higher-value skill is valid.
- AI does not repeatedly request attacks while a cast or weapon attack is already active.
- Large battles evaluate attacks at a maximum delay of two simulation ticks, reducing redundant work while remaining visually immediate.
- Cluster-density targeting is calculated lazily only on target-refresh ticks.

## Facing and anti-stuck movement

- Movement commands carry a separate facing vector.
- Fighters can orbit, retreat or strafe while keeping their weapon pointed at the target.
- Weapon sprites are rendered in the fighter's authoritative facing direction.
- Deterministic stuck detection adds a short escape steering direction after repeated low displacement.
- Ranged fighters derive preferred distance from their equipped weapon.

## Player aiming

- Pointer position is transformed into arena-world coordinates.
- The player faces the pointer independently from WASD movement.
- Left mouse click fires the Basic attack toward the aimed enemy.
- Keyboard and touch skill controls remain available.
- Active player casts and weapon attacks show minimum/maximum range and forward aim direction.

## Fighter Lab gameplay weapons

Fighter Lab now selects real simulation weapons rather than only changing a decorative preview. Equipping a weapon:

- stores the gameplay `weaponId`;
- assigns the reusable `weapon-basic` ability to Basic;
- updates the preview silhouette;
- displays category, range, damage and cadence;
- supports melee, ranged, throwable and continuous weapons.

## Gunner

The new starter fighter **Gunner** uses an **Automatic Rifle**:

- four deterministic projectiles per burst;
- visible rifle held in front of the fighter;
- projectile spread, speed, lifetime, damage and knockback defined as weapon data;
- kiting AI and target-facing movement;
- short procedural high-frequency crack and mechanical transient for each selected shot event.

## 50v50 presentation changes

- The older all-purpose FX engine is suppressed for large/low-quality battles; the budgeted layered VFX engine remains active.
- Important shake, flash and hit-stop feedback is retained without spawning the legacy ring/particle set.
- Mass-battle telegraphs show only a small number of important skills, and 65+ fighter battles prioritize ultimates.
- Low-tier crowd mode hides most status rings, samples weapon-anchor effects and caps projectile trails.
- Audio event selection uses a bounded top-priority pass instead of copying, sorting and slicing every event array.
- The performance warning is rendered below the Skill Activity rail, outside the arena.

## Skill activity

Recent activations remain in the persistent Skill Activity rail for 180 simulation ticks, approximately three seconds at the fixed 60 Hz simulation rate.

## Determinism

All gameplay-facing changes remain command-driven and deterministic. Presentation budgets affect only rendering/audio selection and do not change fighters, AI outcomes, physics, damage, projectiles or winner calculation.
