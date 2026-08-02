export type DamageNumberTier = 'light' | 'medium' | 'heavy' | 'critical' | 'prevented';

export interface DamageNumberPresentation {
  tier: DamageNumberTier;
  color: number;
  fontSize: number;
  lifeSeconds: number;
  risePerSecond: number;
  initialScale: number;
}

/**
 * Resolves damage-number presentation without affecting simulation state.
 * Color is not the only severity signal: stronger hits are also larger, live
 * slightly longer and rise faster for color-vision accessibility.
 */
export function resolveDamageNumberPresentation(amount: number, prevented = false): DamageNumberPresentation {
  const damage = Number.isFinite(amount) ? Math.max(0, amount) : 0;

  if (prevented) {
    return {
      tier: 'prevented',
      color: 0x9ff6ff,
      fontSize: 16,
      lifeSeconds: 0.78,
      risePerSecond: 34,
      initialScale: 0.94
    };
  }

  if (damage >= 25) {
    return {
      tier: 'critical',
      color: 0xff4d5a,
      fontSize: 25,
      lifeSeconds: 1.08,
      risePerSecond: 54,
      initialScale: 1.18
    };
  }

  if (damage >= 12) {
    return {
      tier: 'heavy',
      color: 0xff9f43,
      fontSize: 22,
      lifeSeconds: 0.98,
      risePerSecond: 48,
      initialScale: 1.08
    };
  }

  if (damage >= 5) {
    return {
      tier: 'medium',
      color: 0xffe66d,
      fontSize: 19,
      lifeSeconds: 0.88,
      risePerSecond: 41,
      initialScale: 1
    };
  }

  return {
    tier: 'light',
    color: 0xeaf7ff,
    fontSize: 16,
    lifeSeconds: 0.76,
    risePerSecond: 34,
    initialScale: 0.94
  };
}

export function formatDamageNumber(amount: number, prevented = false): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rounded = Math.round(safeAmount * 10) / 10;
  const value = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return prevented ? `TEST ${value}` : `-${value}`;
}
