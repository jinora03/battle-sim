import { describe, expect, it } from 'vitest';
import {
  getLandscapeFighterCardGeometry,
  getVerticalFighterCardGeometry
} from '@kinetic/video-export';

describe('creator fighter card geometry', () => {
  it('centers the vertical fighter body/name groups and keeps them mirrored', () => {
    const left = getVerticalFighterCardGeometry(
      { x: 16, y: 112, width: 492, height: 200 },
      false
    );
    const right = getVerticalFighterCardGeometry(
      { x: 572, y: 112, width: 492, height: 200 },
      true
    );

    expect(left).toEqual({
      padding: 28,
      name: {
        textX: 195,
        textAlign: 'center',
        maxWidth: 150,
        y: 214
      },
      portrait: {
        centerX: 346,
        centerY: 198,
        radius: 58,
        facing: 'right'
      },
      hp: {
        x: 58,
        y: 282,
        width: 408,
        height: 12
      }
    });

    expect(right).toEqual({
      padding: 28,
      name: {
        textX: 885,
        textAlign: 'center',
        maxWidth: 150,
        y: 214
      },
      portrait: {
        centerX: 734,
        centerY: 198,
        radius: 58,
        facing: 'left'
      },
      hp: {
        x: 614,
        y: 282,
        width: 408,
        height: 12
      }
    });
  });

  it('allocates only a thin HP bar in addition to the vertical body/name group', () => {
    const geometry = getVerticalFighterCardGeometry(
      { x: 16, y: 112, width: 492, height: 200 },
      false
    );

    expect(geometry.hp).toEqual({ x: 58, y: 282, width: 408, height: 12 });
    expect('weapon' in geometry).toBe(false);
    expect('identity' in geometry).toBe(false);
  });

  it('keeps landscape identity, weapon and HP placement in one model', () => {
    const left = getLandscapeFighterCardGeometry(
      { x: 20, y: 56, width: 320, height: 968 },
      false,
      true
    );
    const right = getLandscapeFighterCardGeometry(
      { x: 1580, y: 56, width: 320, height: 968 },
      true,
      true
    );

    expect(left).toMatchObject({
      padding: 24,
      eyebrowY: 90,
      identity: {
        textX: 44,
        textAlign: 'left',
        maxWidth: 160,
        nameY: 132,
        identityY: 162
      },
      weapon: {
        centerX: 278,
        previewY: 164,
        previewSize: 46,
        labelY: 210,
        labelWidth: 106,
        fallbackLabelY: 208,
        fallbackLabelWidth: 98
      },
      hp: {
        labelY: 225,
        bar: { x: 44, y: 238, width: 272, height: 24 },
        valueY: 282
      }
    });

    expect(right.identity).toMatchObject({
      textX: 1876,
      textAlign: 'right',
      maxWidth: 160,
      nameY: 132,
      identityY: 162
    });
    expect(right.weapon?.centerX).toBe(1642);
    expect(right.hp.bar).toEqual({ x: 1604, y: 238, width: 272, height: 24 });
  });
});
