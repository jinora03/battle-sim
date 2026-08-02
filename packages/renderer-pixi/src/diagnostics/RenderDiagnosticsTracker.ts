import type { VisualLod } from '../fighters/types';

export interface RenderDiagnostics {
  lod: VisualLod;
  fighterViews: number;
  pooledFighterViews: number;
  createdFighterViews: number;
  reusedFighterViews: number;
  particleScale: number;
  activeParticles: number;
  vfxQuality: 'low' | 'medium' | 'high';
  groundMarks: number;
  residualParticles: number;
  weaponEffects: number;
  projectileTrails: number;
  qualityScale: number;
  resolution: number;
  devicePixelRatio: number;
  renderScale: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  orientation: 'portrait' | 'landscape';
  resizeCount: number;
  contextLost: boolean;
  renderTier: 'full' | 'crowd' | 'mass';
  targetRenderFps: number;
  presentationEvents: number;
  projectileVisuals: number;
}

const DEFAULT_DIAGNOSTICS: RenderDiagnostics = {
  lod: 'hero',
  fighterViews: 0,
  pooledFighterViews: 0,
  createdFighterViews: 0,
  reusedFighterViews: 0,
  particleScale: 1,
  activeParticles: 0,
  vfxQuality: 'high',
  groundMarks: 0,
  residualParticles: 0,
  weaponEffects: 0,
  projectileTrails: 0,
  qualityScale: 1,
  resolution: 1,
  devicePixelRatio: 1,
  renderScale: 1,
  cssWidth: 1,
  cssHeight: 1,
  pixelWidth: 1,
  pixelHeight: 1,
  orientation: 'landscape',
  resizeCount: 0,
  contextLost: false,
  renderTier: 'full',
  targetRenderFps: 60,
  presentationEvents: 0,
  projectileVisuals: 0
};

export class RenderDiagnosticsTracker {
  private value: RenderDiagnostics = { ...DEFAULT_DIAGNOSTICS };

  get current(): RenderDiagnostics {
    return this.value;
  }

  snapshot(): RenderDiagnostics {
    return { ...this.value };
  }

  update(next: RenderDiagnostics): RenderDiagnostics {
    this.value = next;
    return this.value;
  }

  setContextLost(contextLost: boolean): void {
    this.value = { ...this.value, contextLost };
  }
}
