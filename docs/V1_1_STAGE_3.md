# v1.1 Stage 3 — Weapon and Attack System

Stage 3 extends the existing deterministic ability pipeline rather than creating fighter-specific combat branches. It also includes the requested Battle Lab corrections discovered while reviewing Stage 2.

## Included interface corrections

- The default setup is now AI vs AI.
- Browser audio is enabled in default settings and automatically retries unlock on the first pointer/keyboard gesture when autoplay is blocked.
- The casting/activity strip lives below the arena and remains present in an idle state rather than appearing/disappearing above the playfield.
- The Developer/Performance panel captures `event.currentTarget.open` synchronously before calling the React state updater, avoiding the null/stale synthetic-event crash.
- Pixi observes the actual arena host with `ResizeObserver`, resizes its renderer, recomputes world fit, and hard-centers the camera when no player-follow target is active. This addresses the left-leaning arena after responsive layout changes.
- A manual **Pause battle / Resume battle** control now freezes fixed-tick simulation, AI commands, player movement, projectiles, cooldowns and renderer advancement without ending or restarting the match. Browser lifecycle pause remains independent, and new/rematch/random battles resume automatically.

## Weapon model

`WeaponDefinition` describes standard attacks through data:

- category: melee, ranged, throwable, continuous
- style: swing, thrust, overhead, spin, shot, lob, orbit
- minimum/maximum range
- attack arc
- damage and knockback
- wind-up, active and recovery ticks
- cooldown
- whether movement is allowed
- friendly-fire behavior
- optional projectile recipe
- optional reusable status-on-hit entries
- visual/audio hook IDs

The eight release fighters use:

| Fighter | Weapon | Category / style |
|---|---|---|
| Pyro Brawler | Ember Sword | melee swing |
| Water Shaper | Tidal Spear | melee thrust |
| Mech Bruiser | Steel Hammer | melee overhead |
| Bomber | Demolition Bomb | throwable lob |
| Frost Warden | Cryo Axe | throwable lob/spin |
| Volt Striker | Arc Rifle | ranged shot |
| Thorn Colossus | Thorn Claws | continuous spin |
| Void Reaper | Void Orbit Blade | continuous orbit |

## Deterministic attack lifecycle

```text
Activate basic ability
        ↓
authoritative target/range/LOS/cooldown validation
        ↓
weapon wind-up snapshot
        ↓
active attack window
   ├─ melee/continuous hit query
   └─ ranged/throwable projectile spawn
        ↓
recovery window
        ↓
ready after weapon/ability cooldown
```

The active weapon state is stored outside Pixi and included in `EntitySnapshot`, so renderer replacement, replay recording and headless testing remain possible.

## Projectiles

Projectiles are real simulation objects with stable numeric IDs and previous/current transforms. They support:

- deterministic speed and lifetime
- fuse countdown
- swept segment-vs-circle collision to reduce tunnelling
- arena-wall collision
- obstacle collision
- configurable bounce
- direct weapon damage/knockback/status
- optional radial explosion damage and impulse
- separate visual arc height for thrown objects without corrupting top-down gameplay coordinates

Projectile and weapon state now contributes to simulation checksums.

## Presentation and audio

Pixi renders the equipped weapon and moves it according to the attack style and phase. It also renders bomb, axe and rifle projectiles. Semantic events provide reusable feedback:

- `weaponAttackStarted`
- `weaponHit`
- `projectileSpawned`
- `projectileImpact`

The FX system converts those events into muzzle flashes, directional particles, weapon sparks, shards and impact freeze. The audio engine prioritizes procedural wind-up, shot/throw, hit and projectile-impact cues without importing weapon logic into the simulation.

## Important boundary

Unusual mechanics may still use ability actions/plugins, but normal weapon behavior must remain data-driven. The simulation never checks a fighter ID to decide whether it should swing, shoot or throw.
