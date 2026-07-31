export interface CameraPoint {
  x: number;
  y: number;
}

export interface CameraTransform {
  scale: number;
  x: number;
  y: number;
}

export interface CameraTargetOptions {
  viewportWidth: number;
  viewportHeight: number;
  arenaWidth: number;
  arenaHeight: number;
  baseScale: number;
  focus: CameraPoint | null;
  follow: boolean;
  reducedMotion: boolean;
  followZoom?: number;
  margin?: number;
}

export function calculateArenaFit(
  viewportWidth: number,
  viewportHeight: number,
  arenaWidth: number,
  arenaHeight: number,
  padding = 22
): CameraTransform {
  const safeViewportWidth = Math.max(1, viewportWidth);
  const safeViewportHeight = Math.max(1, viewportHeight);
  const safeArenaWidth = Math.max(1, arenaWidth);
  const safeArenaHeight = Math.max(1, arenaHeight);
  const availableWidth = Math.max(1, safeViewportWidth - padding * 2);
  const availableHeight = Math.max(1, safeViewportHeight - padding * 2);
  const rawScale = Math.min(availableWidth / safeArenaWidth, availableHeight / safeArenaHeight);
  const scale = Math.max(0.1, Number.isFinite(rawScale) ? rawScale : 1);
  return {
    scale,
    x: (safeViewportWidth - safeArenaWidth * scale) / 2,
    y: (safeViewportHeight - safeArenaHeight * scale) / 2
  };
}

export function calculateCameraTarget(options: CameraTargetOptions): CameraTransform {
  const viewportWidth = Math.max(1, options.viewportWidth);
  const viewportHeight = Math.max(1, options.viewportHeight);
  const arenaWidth = Math.max(1, options.arenaWidth);
  const arenaHeight = Math.max(1, options.arenaHeight);
  const margin = Math.max(0, options.margin ?? 12);
  const followZoom = Math.max(1, options.followZoom ?? 1.12);
  const following = Boolean(options.focus && options.follow && !options.reducedMotion);
  const scale = Math.max(0.1, options.baseScale) * (following ? followZoom : 1);
  const scaledWidth = arenaWidth * scale;
  const scaledHeight = arenaHeight * scale;
  let x = (viewportWidth - scaledWidth) / 2;
  let y = (viewportHeight - scaledHeight) / 2;

  if (following && options.focus) {
    x = viewportWidth / 2 - options.focus.x * scale;
    y = viewportHeight / 2 - options.focus.y * scale;
    if (scaledWidth <= viewportWidth - margin * 2) x = (viewportWidth - scaledWidth) / 2;
    else x = Math.min(margin, Math.max(viewportWidth - scaledWidth - margin, x));
    if (scaledHeight <= viewportHeight - margin * 2) y = (viewportHeight - scaledHeight) / 2;
    else y = Math.min(margin, Math.max(viewportHeight - scaledHeight - margin, y));
  }
  return { scale, x, y };
}
