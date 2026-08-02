export interface RendererContextRecoveryCallbacks {
  onLostChange(lost: boolean): void;
  onRestored(): void;
}

export class RendererContextRecovery {
  private canvas: HTMLCanvasElement | null = null;
  private callbacks: RendererContextRecoveryCallbacks | null = null;
  private lost = false;

  get contextLost(): boolean {
    return this.lost;
  }

  bind(canvas: HTMLCanvasElement, callbacks: RendererContextRecoveryCallbacks): void {
    this.unbind();
    this.canvas = canvas;
    this.callbacks = callbacks;
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  unbind(): void {
    this.canvas?.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.canvas = null;
    this.callbacks = null;
    this.lost = false;
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
    this.callbacks?.onLostChange(true);
  };

  private readonly handleContextRestored = (): void => {
    this.lost = false;
    this.callbacks?.onLostChange(false);
    this.callbacks?.onRestored();
  };
}
