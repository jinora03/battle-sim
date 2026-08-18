import type { PrimaryAttackDefinition, WeaponVisualMountDefinition } from '@kinetic/content';

export interface ResolvedWeaponVisualMount {
  id: string;
  side: WeaponVisualMountDefinition['side'];
  forwardOffset: number;
  lateralOffset: number;
  scale: number;
  rotationRadians: number;
}

export interface WeaponVisualMountPose {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

const SIDE_LATERAL_OFFSETS: Record<WeaponVisualMountDefinition['side'], number> = {
  center: 0,
  left: -0.58,
  right: 0.58
};

export function resolvePrimaryAttackVisualMounts(
  attack: Pick<PrimaryAttackDefinition, 'visualMounts' | 'style'>
): readonly ResolvedWeaponVisualMount[] {
  const mounts: readonly WeaponVisualMountDefinition[] = attack.visualMounts?.length
    ? attack.visualMounts
    : [{ id: 'center', side: 'center' }];

  return mounts.map((mount, index) => ({
    id: mount.id || `mount-${index}`,
    side: mount.side,
    forwardOffset: mount.forwardOffset ?? 0,
    lateralOffset: mount.lateralOffset ?? SIDE_LATERAL_OFFSETS[mount.side],
    scale: mount.scale ?? (mount.side === 'center' ? 1 : 0.78),
    // Generic mount sockets never infer a weapon-facing angle. Held weapons
    // rotate around their explicit grip through the anatomy rig instead.
    rotationRadians: (mount.rotationDegrees ?? 0) * Math.PI / 180
  }));
}

export function resolveWeaponVisualMountPose(
  mount: ResolvedWeaponVisualMount,
  fighterRadius: number
): WeaponVisualMountPose {
  return {
    x: fighterRadius * mount.forwardOffset,
    y: fighterRadius * mount.lateralOffset,
    scale: mount.scale,
    rotation: mount.rotationRadians
  };
}
