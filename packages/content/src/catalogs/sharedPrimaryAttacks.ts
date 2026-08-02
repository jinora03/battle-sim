import type { PrimaryAttackDefinition } from '../schemas';

/** Generic attacks available to creator-authored fighters. */
export const SHARED_PRIMARY_ATTACKS: readonly PrimaryAttackDefinition[] = [
  {
    id: 'war-hammer', name: 'War Hammer', form: 'hammer', behavior: 'melee', category: 'melee', style: 'overhead',
    range: 180, minRange: 0, damage: 20, knockback: 10, windupTicks: 15, activeTicks: 5, recoveryTicks: 17,
    cooldownTicks: 48, attackAngleDegrees: 82, visualScale: 1.7, movementAllowed: false, friendlyFire: false,
    visualId: 'war-hammer', audioId: 'hammer-crush'
  },
  {
    id: 'duelist-sword', name: 'Duelist Sword', form: 'sword', behavior: 'melee', category: 'melee', style: 'swing',
    range: 180, minRange: 0, damage: 15, knockback: 6, windupTicks: 9, activeTicks: 5, recoveryTicks: 12,
    cooldownTicks: 36, attackAngleDegrees: 115, visualScale: 1.7, movementAllowed: true, friendlyFire: false,
    visualId: 'duelist-sword', audioId: 'blade-cut'
  },
  {
    id: 'cyclone-sword', name: 'Cyclone Sword', form: 'sword', behavior: 'spin', category: 'spin', style: 'spin',
    range: 170, minRange: 0, damage: 8, knockback: 4.5, windupTicks: 10, activeTicks: 18, recoveryTicks: 16,
    cooldownTicks: 56, attackAngleDegrees: 360, visualScale: 1.7, movementAllowed: true, friendlyFire: false,
    visualId: 'cyclone-sword', audioId: 'blade-spin'
  },
  {
    id: 'lancer-spear', name: 'Lancer Spear', form: 'spear', behavior: 'melee', category: 'melee', style: 'thrust',
    range: 245, minRange: 25, damage: 15, knockback: 7.5, windupTicks: 11, activeTicks: 5, recoveryTicks: 13,
    cooldownTicks: 40, attackAngleDegrees: 46, visualScale: 2.25, movementAllowed: true, friendlyFire: false,
    visualId: 'lancer-spear', audioId: 'spear-thrust'
  },
  {
    id: 'cyclone-spear', name: 'Cyclone Spear', form: 'spear', behavior: 'spin', category: 'spin', style: 'spin',
    range: 190, minRange: 0, damage: 8.5, knockback: 5, windupTicks: 10, activeTicks: 20, recoveryTicks: 16,
    cooldownTicks: 58, attackAngleDegrees: 360, visualScale: 2.05, movementAllowed: true, friendlyFire: false,
    visualId: 'cyclone-spear', audioId: 'spear-spin'
  }
];
