export interface MeleeSkillWeaponPose {
  x: number;
  y: number;
  rotation: number;
}

/**
 * Presentation-only weapon motion for authored melee skills whose gameplay hit
 * uses the same swept weapon envelope. The strike resolves at cast completion,
 * after viewers have seen the held weapon perform the sweep/thrust.
 */
export function resolveMeleeSkillWeaponPose(
  abilityId: string | null,
  progress: number,
  fighterRadius: number
): MeleeSkillWeaponPose | null {
  if (!abilityId) return null;
  const t = Math.max(0, Math.min(1, progress));
  const eased = t * t * (3 - 2 * t);
  switch (abilityId) {
    case 'crosscut':
      return { x: 0, y: 0, rotation: -1.32 + eased * 2.64 };
    case 'duelist-step':
      return { x: -fighterRadius * 0.08 * (1 - eased), y: 0, rotation: -0.92 + eased * 1.84 };
    case 'execution-arc':
      return { x: 0, y: 0, rotation: -1.95 + eased * 3.9 };
    case 'pike-sweep':
      return { x: 0, y: 0, rotation: -1.55 + eased * 3.1 };
    case 'vault-thrust':
      return { x: fighterRadius * 0.64 * Math.sin(t * Math.PI), y: 0, rotation: 0 };
    default:
      return null;
  }
}
