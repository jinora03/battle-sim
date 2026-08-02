import { describe, expect, it } from 'vitest';
import { getAttackSource } from '@kinetic/content';

describe('Stage 8 attack-source renderer regression', () => {
  it('resolves primary attacks and skill projectiles through one safe lookup', () => {
    expect(getAttackSource('flame-fists').id).toBe('flame-fists');
    expect(getAttackSource('automatic-rifle').id).toBe('automatic-rifle');
    expect(getAttackSource('tactical-round').id).toBe('tactical-round');
    expect(getAttackSource('suppressive-round').id).toBe('suppressive-round');
    expect(getAttackSource('pinning-round-projectile').id).toBe('pinning-round-projectile');
    expect(getAttackSource('kill-zone-missile').id).toBe('kill-zone-missile');
  });

  it('still rejects an unknown attack source', () => {
    expect(() => getAttackSource('missing-attack-source')).toThrow(/unknown skill projectile/i);
  });
});
