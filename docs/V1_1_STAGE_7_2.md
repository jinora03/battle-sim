# v1.1 Stage 7.2 — Primary Attack and Fighter Identity Redesign

Stage 7.2 replaces the overlapping display-weapon, gameplay-weapon and Basic-ability concepts with one authoritative **Primary Attack** system. The goal is immediate combat readability: the object or element visible on a fighter is the same source used by its repeated Basic attack, and AI movement derives from that attack's actual range and behavior.

## Authoritative primary attacks

Each fighter now stores `primaryAttackId`. The referenced `PrimaryAttackDefinition` owns:

- attack form and behavior;
- minimum and maximum range;
- damage and knockback;
- wind-up, active, recovery and cooldown timings;
- melee reach and arc;
- projectile, burst, fuse and bounce data where relevant;
- movement and friendly-fire rules;
- status-on-hit, visual scale, effect IDs and audio ID.

The Basic slot is synthesized from this definition. Fighter data no longer stores a separate `abilitySlots.basic`, and normal skills cannot execute the primary attack through `USE_WEAPON`.

## Form + behavior compatibility

Attack identity is represented by two independent concepts:

- **Form:** sword, spear, hammer, axe, claws, rifle, launcher, shield, gauntlet, fire, water, ice, lightning, nature or void.
- **Behavior:** melee, spin, ranged, automatic, throwable, continuous, beam, orbit or slam.

A shared compatibility matrix is used by content validation and Fighter Lab. It supports intentional combinations such as Sword + Melee, Sword + Spin, Spear + Melee and Spear + Spin while rejecting combinations such as Rifle + Spin.

## Dedicated command and simulation lifecycle

Basic input now emits `activatePrimaryAttack`. Skills continue to use `activateAbility`.

The deterministic lifecycle remains:

```text
request → validate → wind-up → active → recovery → cooldown
```

Behavior-specific resolution supports melee, spin, ranged, automatic, throwable, continuous, beam, orbit and slam attacks without branching on fighter IDs. Legacy Basic commands are rerouted for compatibility, while legacy `USE_WEAPON` skill actions no longer execute gameplay attacks.

## Melee readability

Melee validation uses the fighter radius, visible attack reach and target radius rather than requiring body overlap. Primary melee attacks therefore connect at a broader and more understandable distance.

Normal melee weapons remain stable while idle and animate only during wind-up/active/recovery. Only explicit Spin or Orbit behavior rotates. Each melee target is normally hit once per swing unless the attack definition intentionally specifies otherwise.

## Rendering

The separate display-weapon recipe has been removed. Pixi renders the authoritative primary attack directly from `fighter.primaryAttackId`.

- primary attack source is attached to a front-left socket;
- health UI remains upper-right and does not rotate with the fighter;
- weapon/element silhouettes are deliberately oversized for top-down readability;
- ranged attacks aim and recoil;
- automatic attacks recoil per shot;
- throwables visibly leave the fighter;
- elemental fighters render elemental sources instead of fake physical weapons;
- melee attacks do not idle-spin.

Procedural silhouettes currently cover fire, water, lightning, gauntlets, rifles, launchers/bombs, claws, scythes, axes/hammers, spears and swords. These can later be replaced by authored sprites without changing simulation data.

## AI and player control

AI evaluates ready skills first using deterministic priority, then uses the primary attack as the reliable Basic fallback. Approach, kite and preferred-distance behavior derive from the primary attack's real behavior and range.

Player Basic input and left-click aiming use the same dedicated primary-attack command. Skills remain separate.

## Fighter Lab

Fighter Lab now edits:

- Primary Attack Source;
- Attack Form;
- compatible Attack Behavior;
- Primary Attack definition;
- skill slots 1–3 and Ultimate.

The old Display Weapon, Gameplay Weapon and independently editable Basic fields are removed. Basic is shown as a generated read-only consequence of the selected primary attack. Imported schema-v1 bundles are migrated to schema v2.

## Built-in fighter identities

- **Water Shaper:** Pressure Orb — Water + Ranged
- **Bomber:** Demolition Bomb — Launcher + Throwable
- **Pyro Brawler:** Flame Fists — Fire + Melee
- **Mech Bruiser:** Hydraulic Gauntlet — Gauntlet + Slam
- **Frost Warden:** Frost Halberd — Spear + Melee
- **Volt Striker:** Arc Emitter — Lightning + Ranged
- **Thorn Colossus:** Thorn Claws — Claws + Melee
- **Void Reaper:** Void Scythe — Void + Melee
- **Gunner:** Automatic Rifle — Rifle + Automatic

Gunner's four supporting skills are Combat Roll, Suppressive Fire, Grenade Launcher and Overdrive Barrage. Pyro no longer carries a sword, Thorn Claws no longer spin as an idle/default Basic, and Volt Striker no longer duplicates Gunner's conventional-rifle identity.

## Compatibility and migration

Compatibility aliases remain temporarily for older source modules and imported content, but new content should use `PrimaryAttackDefinition`, `getPrimaryAttack`, `listPrimaryAttacks` and `primaryAttackId`.

Schema-v1 Fighter Lab bundles migrate by:

1. resolving the legacy gameplay weapon/Basic pairing to a primary attack;
2. removing `abilitySlots.basic`;
3. removing legacy `fighter.weaponId`;
4. removing `visualRecipe.weapon`;
5. emitting a schema-v2 bundle.
