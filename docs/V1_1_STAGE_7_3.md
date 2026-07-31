# v1.1 Stage 7.3 — Combat Readability, Group AI and Missile Artillery

Stage 7.3 is a focused gameplay-polish pass on top of Stage 7.2. It keeps the deterministic simulation, Primary Attack architecture and presentation/gameplay boundary intact.

## Renderer lifecycle

BattleRuntime owns one retained Pixi renderer. When the Battle view becomes active, the application gives the runtime the current arena host, reattaches the existing canvas, reconnects resize observation, forces a real host measurement and refits the camera. Returning from Ability Lab no longer requires a battle restart or page reload.

## Player targeting

`packages/renderer-pixi/src/playerTargeting.ts` is the single pure targeting-preview module. It resolves Basic and skill ranges from content and evaluates minimum range, maximum range and line of sight without React-specific logic.

The player renderer shows:

- the selected attack's maximum valid range
- its minimum range where relevant
- a world-space crosshair
- an aim arrow anchored to the fighter perimeter and rotated toward the mouse
- valid, too-close, blocked and out-of-range feedback

Skill buttons only notify the runtime which slot to preview. They do not duplicate range calculations.

## Combat feedback

Fighter HP is now represented by a circular arc around the body. A delayed amber arc shows recently lost HP, while low health receives a restrained pulse. The player ring is slightly thicker, and Army LOD uses a reduced line width.

Damage feedback uses a brief white/red body overlay, stronger impact squash and an actual contact-point effect. Player hits receive a crisp hitmarker sound; damage received uses a distinct low impact cue. High-speed wall contact adds a flash, shockwave, debris, optional hit-stop and its own sound.

## Knockback

Explosion force is still authored independently, but runtime impulse is scaled consistently by the damage magnitude. Bomber's non-Basic explosion skills and missile explosions therefore produce meaningful displacement without tying all balance directly to damage.

## AI movement and targeting

AI continues to emit ordinary simulation commands. Stage 7.3 adds:

- predicted target position during cast wind-up
- cluster scoring for area abilities
- authoritative range validation as a second safety boundary
- local enemy-pressure sampling for ranged fighters
- deterministic engagement positions for melee allies
- target-load penalties and ally separation
- anti-stuck escape steering
- soft approach, strafe and retreat bands rather than rigid distance locks

Large battles use the same rules but avoid expensive deep scans every tick.

## Balance and silhouettes

- Gunner keeps the four-round burst but deals substantially less damage per bullet.
- Bomber's Basic projectile is faster, larger and gently guided.
- Sword and spear silhouettes are wider and easier to identify.
- Melee reach remains broader than raw weapon range by including attacker and target radii.

## Rocket Vanguard

Rocket Vanguard is a new unlocked fighter with a coherent missile-artillery kit:

- Basic: Guided Rocket
- Skill 1: Boosted Barrage
- Skill 2: Blast Jump
- Skill 3: Siege Marker
- Ultimate: Starburst Convergence

Starburst launches sixteen real micro-missile entities radially. After a deterministic delay, they curve back toward the selected target with smoke trails and cascading impact timing. Logical projectile count and VFX budgets remain bounded for large battles.
