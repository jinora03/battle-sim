import { Graphics } from 'pixi.js';
import type { PresentationSettings } from '@kinetic/visual-engine';

export class ScreenFlashLayer {
  readonly graphics = new Graphics();
  private intensity = 0;

  raise(value: number): void {
    this.intensity = Math.max(this.intensity, value);
  }

  draw(settings: PresentationSettings, dtMs: number, width: number, height: number): void {
    this.graphics.clear();
    if (!settings.effects || !settings.screenFlash || this.intensity <= 0.005) {
      this.intensity = 0;
      return;
    }
    this.graphics.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: this.intensity * 0.16 });
    this.intensity *= Math.pow(0.78, Math.max(1, dtMs / 16.67));
  }

  reset(): void {
    this.intensity = 0;
    this.graphics.clear();
  }
}
