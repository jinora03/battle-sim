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

  return mounts.map((mount, index) => {
    const swingSideAngle = attack.style === 'swing' && mount.side !== 'center'
      ? (mount.side === 'right' ? 72 : -72)
      : 0;
    return {
      id: mount.id || `mount-${index}`,
      side: mount.side,
      forwardOffset: mount.forwardOffset ?? 0,
      lateralOffset: mount.lateralOffset ?? SIDE_LATERAL_OFFSETS[mount.side],
      scale: mount.scale ?? (mount.side === 'center' ? 1 : 0.78),
      rotationRadians: (mount.rotationDegrees ?? swingSideAngle) * Math.PI / 180
    };
  });
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
