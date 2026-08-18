import { describe, expect, it } from 'vitest';
import { resolveSwingSmear, resolveThrustStreak } from '../packages/renderer-pixi/src/meleeStrikeSmear';

/**
 * Stage 9D melee readability: the swing/thrust FX should read as a motion blur
 * derived from the real blade pose — a trail that lengthens with blade speed,
 * fades from the current edge back to where the blade came from, and collapses
 * to nothing at the start and end of the stroke. These tests pin that shape on
 * the pure geometry (the renderer only strokes the returned slices).
 */

describe('swing smear geometry', () => {
  const build = (progress: number, samples = 6) =>
    resolveSwingSmear({ handX: 0, handY: 0, bladeAngle: 0.5, reach: 200, progress, intensity: 1, samples });

  it('trails behind the current blade edge and fades toward the oldest slice', () => {
    const smear = build(0.5);
    const lead = smear.slices[0];
    const oldest = smear.slices[smear.slices.length - 1];
    expect(lead.angle).toBeCloseTo(0.5, 9); // newest slice sits on the blade
    expect(oldest.angle).toBeLessThan(lead.angle); // trail recedes toward decreasing angle
    for (let i = 1; i < smear.slices.length; i += 1) {
      expect(smear.slices[i].alpha).toBeLessThanOrEqual(smear.slices[i - 1].alpha + 1e-9);
    }
    expect(lead.alpha).toBeGreaterThan(oldest.alpha);
  });

  it('lengthens the blur with blade speed and collapses at the ends of the stroke', () => {
    const start = build(0).spanRadians;
    const quarter = build(0.25).spanRadians;
    const mid = build(0.5).spanRadians;
    const end = build(1).spanRadians;
    expect(mid).toBeGreaterThan(quarter);
    expect(quarter).toBeGreaterThan(start);
    expect(mid).toBeGreaterThan(end);
    expect(start).toBeGreaterThan(0);
  });

  it('places the leading tip at the blade reach along the current angle', () => {
    const smear = resolveSwingSmear({ handX: 10, handY: 20, bladeAngle: 0, reach: 100, progress: 0.5, intensity: 1, samples: 5 });
    expect(smear.leadTip.x).toBeCloseTo(110, 9);
    expect(smear.leadTip.y).toBeCloseTo(20, 9);
  });

  it('honours the requested slice count (e.g. reduced motion)', () => {
    expect(build(0.5, 3).slices).toHaveLength(3);
    expect(build(0.5, 6).slices).toHaveLength(6);
  });

  it('is deterministic', () => {
    expect(build(0.4)).toEqual(build(0.4));
  });
});

describe('thrust streak geometry', () => {
  const build = (progress: number, samples = 5) =>
    resolveThrustStreak({ handX: 0, handY: 0, thrustAngle: 0, reach: 150, extension: 60, progress, intensity: 1, samples });

  it('keeps the leading tip brightest and fades the receding echoes', () => {
    const streak = build(0.5);
    expect(streak.segments[0].alpha).toBeCloseTo(1, 9);
    for (let i = 1; i < streak.segments.length; i += 1) {
      expect(streak.segments[i].alpha).toBeLessThanOrEqual(streak.segments[i - 1].alpha + 1e-9);
    }
  });

  it('extends further at peak lunge speed', () => {
    const start = build(0).length;
    const mid = build(0.5).length;
    expect(mid).toBeGreaterThan(start);
    expect(start).toBeGreaterThanOrEqual(150); // never shorter than the static reach
  });

  it('projects the tip forward along the thrust axis', () => {
    const streak = resolveThrustStreak({ handX: 5, handY: 0, thrustAngle: 0, reach: 100, extension: 40, progress: 1, intensity: 1, samples: 4 });
    expect(streak.tip.y).toBeCloseTo(0, 9);
    expect(streak.tip.x).toBeGreaterThan(5 + 100);
  });

  it('is deterministic', () => {
    expect(build(0.6)).toEqual(build(0.6));
  });
});
