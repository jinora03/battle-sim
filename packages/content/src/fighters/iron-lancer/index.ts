import fighterRaw from '../../data/fighters/iron-lancer.json';
import aiProfileRaw from '../../data/ai/iron-charger.json';
import lanceChargeRaw from '../../data/abilities/lance-charge.json';
import pikeSweepRaw from '../../data/abilities/pike-sweep.json';
import vaultThrustRaw from '../../data/abilities/vault-thrust.json';
import breakthroughChargeRaw from '../../data/abilities/breakthrough-charge.json';
import type { FighterContentBundle } from '../types';

export const ironLancerContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [lanceChargeRaw, pikeSweepRaw, vaultThrustRaw, breakthroughChargeRaw],
  primaryAttack: {
    id: 'war-spear', name: 'War Spear', form: 'spear', behavior: 'melee', category: 'melee', style: 'thrust',
    range: 250, minRange: 45, damage: 14.5, knockback: 8.6, windupTicks: 10, activeTicks: 5, recoveryTicks: 12,
    cooldownTicks: 36, attackAngleDegrees: 48, visualScale: 1.62, visualMounts: [{ id: 'center', side: 'center' }], visualGrip: { hand: 'right', x: 0.08, support: { hand: 'left', x: 0.36 } },
    movementAllowed: true, friendlyFire: false, visualId: 'war-spear', audioId: 'spear-thrust'
  }
};
