import { resolveCanvasResolution } from '@kinetic/platform';
import type { PresentationSettings } from '@kinetic/visual-engine';

export interface RendererSettingsChanges {
  profileChanged: boolean;
  arenaBackgroundChanged: boolean;
  resolutionChanged: boolean;
  followChanged: boolean;
}

export class RendererSettingsController {
  private value: PresentationSettings | null = null;
  private adaptivePerformanceScale = 1;
  private resolutionOverride: number | null = null;

  get hasSettings(): boolean {
    return this.value !== null;
  }

  get current(): PresentationSettings {
    if (!this.value) throw new Error('Renderer settings have not been initialized.');
    return this.value;
  }

  get performanceScale(): number {
    return this.adaptivePerformanceScale;
  }

  set(settings: PresentationSettings): RendererSettingsChanges {
    const previous = this.value;
    this.value = { ...settings };
    return {
      profileChanged: previous?.renderProfile !== settings.renderProfile,
      arenaBackgroundChanged: previous?.arenaBackground !== settings.arenaBackground,
      resolutionChanged: previous?.maxDevicePixelRatio !== settings.maxDevicePixelRatio
        || previous?.renderScale !== settings.renderScale
        || previous?.adaptiveQuality !== settings.adaptiveQuality,
      followChanged: previous?.cameraFollow !== settings.cameraFollow
    };
  }

  setResolutionOverride(resolution: number | null): void {
    this.resolutionOverride = resolution === null ? null : Math.max(0.5, Math.min(3, resolution));
  }

  setPerformanceScale(scale: number): boolean {
    const next = Math.max(0.35, Math.min(1, scale));
    if (Math.abs(next - this.adaptivePerformanceScale) < 0.001) return false;
    this.adaptivePerformanceScale = next;
    return true;
  }

  resolveResolution(): number {
    if (this.resolutionOverride !== null) return this.resolutionOverride;
    const settings = this.value;
    const adaptiveScale = settings?.adaptiveQuality
      ? 0.58 + this.adaptivePerformanceScale * 0.42
      : 1;
    return resolveCanvasResolution({
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      maxDevicePixelRatio: settings?.maxDevicePixelRatio ?? 1,
      renderScale: settings?.renderScale ?? 1,
      adaptiveScale
    }).effectiveResolution;
  }
}
