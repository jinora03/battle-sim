# v1.3.23 Stage 8.8C — Configured Match Intro

Stage 8.8C rebuilds the pre-battle versus presentation around the active Battle Setup rather than generic decorative portraits.

## Presentation changes

- Names are larger while fighter portraits are smaller and given more breathing room.
- Team 1 / Team 2 labels are removed.
- The dotted targeting ring and generic side capsules are removed.
- Each fighter shows its elemental/archetype identity and authoritative primary weapon.
- Fighters with one or more configured modules use the label `Fighter · Tuned Version`.
- Standard fighters keep their normal content name.
- Weapon silhouettes point toward the opposing fighter.
- Body templates use the registered visual recipe shape.
- Mounted module attachments are represented from the selected module definitions.
- Squad modes show a neutral squad-size line instead of a team label.

## Data flow

The ready/introduction overlay receives `moduleIdsA` and `moduleIdsB` from the same active or configured setup already used by the simulation. The display label does not mutate fighter IDs or content definitions.

## Scope boundary

No simulation, balance, ability, AI, seed, physics, or replay behavior changes in this stage.
