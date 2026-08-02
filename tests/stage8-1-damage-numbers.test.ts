import { describe, expect, it } from 'vitest';
import { formatDamageNumber, resolveDamageNumberPresentation } from '../packages/renderer-pixi/src/combatText';

describe('Stage 8.1 damage-number presentation', () => {
  it('maps increasing damage to increasingly strong visual tiers', () => {
    const light = resolveDamageNumberPresentation(3.4);
    const medium = resolveDamageNumberPresentation(8);
    const heavy = resolveDamageNumberPresentation(18);
    const critical = resolveDamageNumberPresentation(40);

    expect(light.tier).toBe('light');
    expect(medium.tier).toBe('medium');
    expect(heavy.tier).toBe('heavy');
    expect(critical.tier).toBe('critical');
    expect(light.fontSize).toBeLessThan(medium.fontSize);
    expect(medium.fontSize).toBeLessThan(heavy.fontSize);
    expect(heavy.fontSize).toBeLessThan(critical.fontSize);
  });

  it('formats ordinary and prevented damage without noisy trailing decimals', () => {
    expect(formatDamageNumber(3.4)).toBe('-3.4');
    expect(formatDamageNumber(20)).toBe('-20');
    expect(formatDamageNumber(12.04)).toBe('-12');
    expect(formatDamageNumber(9.96, true)).toBe('TEST 10');
  });

  it('uses a separate non-damage presentation for training-only prevented hits', () => {
    const prevented = resolveDamageNumberPresentation(30, true);
    expect(prevented.tier).toBe('prevented');
    expect(prevented.fontSize).toBeLessThan(resolveDamageNumberPresentation(30).fontSize);
  });
});
