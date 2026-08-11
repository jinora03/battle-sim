import { describe, expect, it } from 'vitest';
import {
  BROADCAST_LAYOUTS,
  getBroadcastLayout,
  getCreatorLayoutGeometry
} from '@kinetic/video-export';

describe('creator export layout geometry', () => {
  it('keeps the approved vertical creator composition in one geometry model', () => {
    const geometry = getCreatorLayoutGeometry(BROADCAST_LAYOUTS.vertical);

    expect(geometry).toMatchObject({
      id: 'vertical',
      arena: { x: 40, y: 350, width: 1000, height: 1000 },
      context: { centerX: 540, modeY: 58, arenaTypeY: 86 },
      fighterHeaders: {
        left: { x: 16, y: 112, width: 492, height: 200 },
        right: { x: 572, y: 112, width: 492, height: 200 }
      },
      versus: { x: 540, y: 212 },
      skillsPanels: {
        left: { x: 40, y: 1380, width: 490, height: 420 },
        right: { x: 550, y: 1380, width: 490, height: 420 }
      }
    });
  });

  it('keeps the approved landscape fighter rails around the arena', () => {
    const geometry = getCreatorLayoutGeometry(BROADCAST_LAYOUTS.landscape);

    expect(geometry).toMatchObject({
      id: 'landscape',
      arena: { x: 350, y: 48, width: 1220, height: 984 },
      fighterPanels: {
        left: { x: 20, y: 56, width: 320, height: 968 },
        right: { x: 1580, y: 56, width: 320, height: 968 }
      }
    });
  });

  it('scales surrounding creator geometry with scaled broadcast layouts', () => {
    const geometry = getCreatorLayoutGeometry(getBroadcastLayout('vertical', 2));

    expect(geometry).toMatchObject({
      id: 'vertical',
      arena: { x: 80, y: 700, width: 2000, height: 2000 },
      context: { centerX: 1080, modeY: 116, arenaTypeY: 172 },
      fighterHeaders: {
        left: { x: 32, y: 224, width: 984, height: 400 },
        right: { x: 1144, y: 224, width: 984, height: 400 }
      },
      versus: { x: 1080, y: 424 },
      skillsPanels: {
        left: { x: 80, y: 2760, width: 980, height: 840 },
        right: { x: 1100, y: 2760, width: 980, height: 840 }
      }
    });
  });
});
