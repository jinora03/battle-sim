import fighterRaw from '../../data/fighters/blade-vanguard.json';
import aiProfileRaw from '../../data/ai/blade-duelist.json';
import drivingSlashRaw from '../../data/abilities/driving-slash.json';
import crosscutRaw from '../../data/abilities/crosscut.json';
import duelistStepRaw from '../../data/abilities/duelist-step.json';
import executionArcRaw from '../../data/abilities/execution-arc.json';
import type { FighterContentBundle } from '../types';

export const bladeVanguardContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [drivingSlashRaw, crosscutRaw, duelistStepRaw, executionArcRaw],
  primaryAttack: {
    id: 'vanguard-longsword', name: 'Vanguard Longsword', form: 'sword', behavior: 'melee', category: 'melee', style: 'swing',
    range: 225, minRange: 12, damage: 15.5, knockback: 7.8, windupTicks: 8, activeTicks: 5, recoveryTicks: 10,
    cooldownTicks: 31, attackAngleDegrees: 102, visualScale: 1.85, visualMounts: [{ id: 'center', side: 'center' }], visualGrip: { hand: 'right', x: -0.02 },
    movementAllowed: true, friendlyFire: false, visualId: 'vanguard-longsword', audioId: 'blade-cut'
  }
};
