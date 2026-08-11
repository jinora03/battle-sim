import { describe, expect, it } from 'vitest';
import {
  getLandscapeFighterCardGeometry,
  getVerticalFighterCardGeometry
} from '@kinetic/video-export';

describe('creator fighter card geometry', () => {
  it('keeps the approved vertical fighter-card internals mirrored', () => {
    const left = getVerticalFighterCardGeometry(
      { x: 16, y: 112, width: 492, height: 200 },
      false,
      true
    );
    const right = getVerticalFighterCardGeometry(
      { x: 572, y: 112, width: 492, height: 200 },
      true,
      true
    );

    expect(left).toMatchObject({
      padding: 28,
      identity: {
        textX: 44,
        textAlign: 'left',
        maxWidth: 268,
        nameY: 186,
        identityY: 232
      },
      weapon: {
        centerX: 396,
        previewY: 176,
        previewSize: 92,
        labelY: 250,
        labelWidth: 116
      },
      hp: {
        labelY: null,
        bar: { x: 44, y: 262, width: 436, height: 22 },
        valueY: 296
      }
    });

    expect(right).toMatchObject({
      padding: 28,
      identity: {
        textX: 1036,
        textAlign: 'right',
        maxWidth: 268,
        nameY: 186,
        identityY: 232
      },
      weapon: {
        centerX: 684,
        previewY: 176,
        previewSize: 92,
        labelY: 250,
        labelWidth: 116
      },
      hp: {
        labelY: null,
        bar: { x: 600, y: 262, width: 436, height: 22 },
        valueY: 296
      }
    });
  });

  it('gives multi-fighter vertical cards the full identity width and no weapon block', () => {
    const geometry = getVerticalFighterCardGeometry(
      { x: 16, y: 112, width: 492, height: 200 },
      false,
      false
    );

    expect(geometry.identity.maxWidth).toBe(436);
    expect(geometry.weapon).toBeNull();
    expect(geometry.hp.bar).toEqual({ x: 44, y: 262, width: 436, height: 22 });
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
