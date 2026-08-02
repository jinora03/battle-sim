import fighterRaw from '../../data/fighters/mech-bruiser.json';
import aiProfileRaw from '../../data/ai/heavy-bruiser.json';
import kineticPulseRaw from '../../data/abilities/kinetic-pulse.json';
import magnetDragRaw from '../../data/abilities/magnet-drag.json';
import fortifyRaw from '../../data/abilities/fortify.json';
import reactorOverdriveRaw from '../../data/abilities/reactor-overdrive.json';
import type { FighterContentBundle } from '../types';

export const mechContent: FighterContentBundle = {
  fighter: fighterRaw,
  aiProfile: aiProfileRaw,
  abilities: [kineticPulseRaw, magnetDragRaw, fortifyRaw, reactorOverdriveRaw],
  primaryAttack: {
    id: 'hydraulic-gauntlet', name: 'Hydraulic Gauntlet', form: 'gauntlet', behavior: 'slam', category: 'slam', style: 'slam',
    range: 150, minRange: 0, damage: 22, knockback: 10.5, windupTicks: 15, activeTicks: 5, recoveryTicks: 18,
    cooldownTicks: 50, attackAngleDegrees: 88, visualScale: 1.6, movementAllowed: false, friendlyFire: false,
    visualId: 'hydraulic-gauntlet', audioId: 'piston-slam'
  }
};
