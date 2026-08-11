import {
  BROADCAST_LAYOUTS,
  type BroadcastLayoutDefinition,
  type BroadcastRect
} from './broadcastLayout';

export interface CreatorLayoutPoint {
  x: number;
  y: number;
}

export interface VerticalCreatorLayoutGeometry {
  id: 'vertical';
  arena: BroadcastRect;
  context: {
    centerX: number;
    modeY: number;
    arenaTypeY: number;
  };
  fighterHeaders: {
    left: BroadcastRect;
    right: BroadcastRect;
  };
  versus: CreatorLayoutPoint;
  skillsPanels: {
    left: BroadcastRect;
    right: BroadcastRect;
  };
}

export interface LandscapeCreatorLayoutGeometry {
  id: 'landscape';
  arena: BroadcastRect;
  fighterPanels: {
    left: BroadcastRect;
    right: BroadcastRect;
  };
}

export type CreatorLayoutGeometry = VerticalCreatorLayoutGeometry | LandscapeCreatorLayoutGeometry;

const VERTICAL_BASE: Omit<VerticalCreatorLayoutGeometry, 'arena'> = {
  id: 'vertical',
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
};

const LANDSCAPE_BASE: Omit<LandscapeCreatorLayoutGeometry, 'arena'> = {
  id: 'landscape',
  fighterPanels: {
    left: { x: 20, y: 56, width: 320, height: 968 },
    right: { x: 1580, y: 56, width: 320, height: 968 }
  }
};

/**
 * Resolves the top-level creator composition around the arena. The arena itself
 * remains authoritative in broadcastLayout.ts; this module owns the surrounding
 * matchup, VS, skill and fighter-panel geometry used by the renderers.
 */
export function getCreatorLayoutGeometry(layout: BroadcastLayoutDefinition): CreatorLayoutGeometry {
  const baseLayout = BROADCAST_LAYOUTS[layout.id];
  const scale = layout.width / baseLayout.width;

  if (layout.id === 'vertical') {
    return {
      id: 'vertical',
      arena: layout.arena,
      context: {
        centerX: scaleValue(VERTICAL_BASE.context.centerX, scale),
        modeY: scaleValue(VERTICAL_BASE.context.modeY, scale),
        arenaTypeY: scaleValue(VERTICAL_BASE.context.arenaTypeY, scale)
      },
      fighterHeaders: {
        left: scaleRect(VERTICAL_BASE.fighterHeaders.left, scale),
        right: scaleRect(VERTICAL_BASE.fighterHeaders.right, scale)
      },
      versus: scalePoint(VERTICAL_BASE.versus, scale),
      skillsPanels: {
        left: scaleRect(VERTICAL_BASE.skillsPanels.left, scale),
        right: scaleRect(VERTICAL_BASE.skillsPanels.right, scale)
      }
    };
  }

  return {
    id: 'landscape',
    arena: layout.arena,
    fighterPanels: {
      left: scaleRect(LANDSCAPE_BASE.fighterPanels.left, scale),
      right: scaleRect(LANDSCAPE_BASE.fighterPanels.right, scale)
    }
  };
}

function scalePoint(point: CreatorLayoutPoint, scale: number): CreatorLayoutPoint {
  return {
    x: scaleValue(point.x, scale),
    y: scaleValue(point.y, scale)
  };
}

function scaleRect(rect: BroadcastRect, scale: number): BroadcastRect {
  return {
    x: scaleValue(rect.x, scale),
    y: scaleValue(rect.y, scale),
    width: scaleValue(rect.width, scale),
    height: scaleValue(rect.height, scale)
  };
}

function scaleValue(value: number, scale: number): number {
  return Math.round(value * scale);
}
