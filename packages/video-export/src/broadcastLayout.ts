export type BroadcastLayoutId = 'landscape' | 'vertical';

export interface BroadcastRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BroadcastLayoutDefinition {
  id: BroadcastLayoutId;
  label: string;
  aspectLabel: '16:9' | '9:16';
  width: number;
  height: number;
  arena: BroadcastRect;
  safeArea: BroadcastRect;
}

export const BROADCAST_LAYOUTS: Readonly<Record<BroadcastLayoutId, BroadcastLayoutDefinition>> = {
  landscape: {
    id: 'landscape',
    label: 'Landscape',
    aspectLabel: '16:9',
    width: 1920,
    height: 1080,
    // Keep the arena dominant while giving both fighter rails a little more
    // physical width for phone playback of 16:9 uploads.
    arena: { x: 350, y: 48, width: 1220, height: 984 },
    safeArea: { x: 20, y: 24, width: 1880, height: 1032 }
  },
  vertical: {
    id: 'vertical',
    label: 'Vertical',
    aspectLabel: '9:16',
    width: 1080,
    height: 1920,
    // Arena-first Shorts composition. The +15% height increase is intentionally
    // conservative for this pass so fighters become more readable without
    // jumping immediately to the earlier 25-40% enlargement target.
    arena: { x: 40, y: 330, width: 1000, height: 1150 },
    safeArea: { x: 48, y: 54, width: 900, height: 1740 }
  }
};

export function getBroadcastLayout(id: BroadcastLayoutId, scale = 1): BroadcastLayoutDefinition {
  const base = BROADCAST_LAYOUTS[id];
  if (scale === 1) return base;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid broadcast layout scale: ${scale}`);
  return {
    ...base,
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
    arena: scaleRect(base.arena, scale),
    safeArea: scaleRect(base.safeArea, scale)
  };
}

function scaleRect(rect: BroadcastRect, scale: number): BroadcastRect {
  return {
    x: Math.round(rect.x * scale),
    y: Math.round(rect.y * scale),
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale)
  };
}
