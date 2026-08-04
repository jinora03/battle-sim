import { Application } from 'pixi.js';
import { RendererContextRecovery } from './RendererContextRecovery';

export interface RendererLifecycleCallbacks {
  resolveResolution(): number;
  onReady(): void;
  onResize(): void;
  onContextLostChange(lost: boolean): void;
  onContextRestored(): void;
}

export class RendererLifecycle {
  readonly app = new Application();

  private readonly contextRecovery = new RendererContextRecovery();
  private hostElement: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeRaf = 0;
  private resizeForcePending = false;
  private settleResizeTimer = 0;
  private ready = false;
  private disposed = false;
  private enabled = true;
  private hostWidth = 0;
  private hostHeight = 0;
  private resolution = 1;
  private resizeTotal = 0;

  constructor(private readonly callbacks: RendererLifecycleCallbacks) {}

  get initialized(): boolean { return this.ready; }
  get destroyed(): boolean { return this.disposed; }
  get active(): boolean { return this.enabled; }
  get contextLost(): boolean { return this.contextRecovery.contextLost; }
  get host(): HTMLElement | null { return this.hostElement; }
  get lastHostWidth(): number { return this.hostWidth; }
  get lastHostHeight(): number { return this.hostHeight; }
  get lastResolution(): number { return this.resolution; }
  get resizeCount(): number { return this.resizeTotal; }

  async initialize(host: HTMLElement): Promise<void> {
    if (this.disposed) throw new Error('Battle renderer has been destroyed.');
    this.hostElement = host;
    if (!host.isConnected) throw new Error('Battle renderer host is not connected.');
    const initialWidth = Math.max(1, Math.round(host.getBoundingClientRect().width || host.clientWidth));
    const initialHeight = Math.max(1, Math.round(host.getBoundingClientRect().height || host.clientHeight));
    if (initialWidth < 32 || initialHeight < 32) throw new Error('Battle renderer host does not have a usable layout yet.');

    this.resolution = this.callbacks.resolveResolution();
    await this.app.init({
      width: initialWidth,
      height: initialHeight,
      backgroundColor: 0x05070d,
      antialias: true,
      autoDensity: true,
      resolution: this.resolution,
      preference: 'webgl',
      sharedTicker: false
    });

    if (this.disposed) {
      this.app.destroy(true, { children: true });
      throw new Error('Battle renderer was destroyed during initialization.');
    }
    const mountHost = this.hostElement;
    if (!mountHost?.isConnected) {
      this.app.destroy(true, { children: true });
      throw new Error('Battle renderer host was removed during initialization.');
    }

    this.configureCanvas();
    mountHost.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.enabled ? 'visible' : 'hidden';
    this.bindResizeObserver(mountHost);
    window.addEventListener('resize', this.handleViewportResize, { passive: true });
    window.addEventListener('orientationchange', this.handleViewportResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.handleViewportResize, { passive: true });
    this.contextRecovery.bind(this.app.canvas, {
      onLostChange: (lost) => this.callbacks.onContextLostChange(lost),
      onRestored: () => {
        this.callbacks.onContextRestored();
        this.queueResize(true);
      }
    });
    this.ready = true;
    this.callbacks.onReady();
    this.syncSize(true);
  }

  attachHost(host: HTMLElement): boolean {
    if (this.ready && this.hostElement === host && this.app.canvas.parentElement === host) {
      this.ensureCanvasMounted();
      this.queueResize(true);
      return false;
    }
    this.hostElement = host;
    if (!this.ready) return true;
    this.bindResizeObserver(host);
    host.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.enabled ? 'visible' : 'hidden';
    this.hostWidth = 0;
    this.hostHeight = 0;
    this.queueResize(true);
    requestAnimationFrame(() => this.queueResize(true));
    return true;
  }

  setActive(active: boolean): void {
    this.enabled = active;
    if (!this.ready) return;
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = active ? 'visible' : 'hidden';
    if (!active) {
      this.app.stop();
      return;
    }
    this.ensureCanvasMounted();
    this.app.start();
    this.hostWidth = 0;
    this.hostHeight = 0;
    this.queueResize(true);
    requestAnimationFrame(() => {
      if (!this.enabled) return;
      this.ensureCanvasMounted();
      this.queueResize(true);
      requestAnimationFrame(() => {
        if (!this.enabled) return;
        this.ensureCanvasMounted();
        this.queueResize(true);
      });
    });
  }

  ensureCanvasMounted(): void {
    if (!this.ready || !this.hostElement) return;
    if (this.app.canvas.parentElement !== this.hostElement) this.hostElement.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.enabled ? 'visible' : 'hidden';
  }

  queueResize(force = false): void {
    if (!this.ready) return;
    this.resizeForcePending ||= force;
    if (this.resizeRaf !== 0) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      const shouldForce = this.resizeForcePending;
      this.resizeForcePending = false;
      this.syncSize(shouldForce);
    });
  }

  refreshLayout(): void {
    if (!this.ready || this.disposed) return;
    this.ensureCanvasMounted();
    this.hostWidth = 0;
    this.hostHeight = 0;
    this.queueResize(true);
    window.clearTimeout(this.settleResizeTimer);
    this.settleResizeTimer = window.setTimeout(() => {
      if (!this.ready || this.disposed) return;
      this.ensureCanvasMounted();
      this.hostWidth = 0;
      this.hostHeight = 0;
      this.queueResize(true);
    }, 180);
  }

  syncSize(force: boolean): void {
    if (!this.ready || !this.hostElement || !this.hostElement.isConnected || this.contextRecovery.contextLost) return;
    this.ensureCanvasMounted();
    const rect = this.hostElement.getBoundingClientRect();
    const measuredWidth = rect.width || this.hostElement.clientWidth;
    const measuredHeight = rect.height || this.hostElement.clientHeight;
    if (measuredWidth < 2 || measuredHeight < 2) return;
    const width = Math.max(1, Math.round(measuredWidth));
    const height = Math.max(1, Math.round(measuredHeight));
    const resolution = this.callbacks.resolveResolution();
    const widthDelta = Math.abs(width - this.hostWidth);
    const heightDelta = Math.abs(height - this.hostHeight);
    const sizeChanged = force ? widthDelta > 0 || heightDelta > 0 : widthDelta >= 2 || heightDelta >= 2;
    const resolutionChanged = Math.abs(resolution - this.resolution) >= 0.01;
    if (!sizeChanged && !resolutionChanged) return;
    this.hostWidth = width;
    this.hostHeight = height;
    this.resolution = resolution;
    this.app.renderer.resolution = resolution;
    this.app.renderer.resize(width, height);
    this.resizeTotal += 1;
    this.callbacks.onResize();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeRaf !== 0) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = 0;
    window.clearTimeout(this.settleResizeTimer);
    this.settleResizeTimer = 0;
    window.removeEventListener('resize', this.handleViewportResize);
    window.removeEventListener('orientationchange', this.handleViewportResize);
    window.visualViewport?.removeEventListener('resize', this.handleViewportResize);
    this.contextRecovery.unbind();
    if (this.ready) this.app.destroy(true, { children: true });
    this.ready = false;
    this.hostElement = null;
  }

  private configureCanvas(): void {
    this.app.canvas.classList.add('kinetic-render-canvas');
    this.app.canvas.setAttribute('aria-hidden', 'true');
    // The arena is display-only on touch; React and the analog stick own input.
    this.app.canvas.style.touchAction = 'pan-y';
    this.app.renderer.events.autoPreventDefault = false;
  }

  private bindResizeObserver(host: HTMLElement): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => this.queueResize(false))
      : null;
    if (!this.resizeObserver) return;
    try {
      this.resizeObserver.observe(host, { box: 'content-box' });
    } catch {
      // Older mobile Chromium/WebView builds can reject the options object.
      this.resizeObserver.observe(host);
    }
  }

  private readonly handleViewportResize = (): void => {
    this.refreshLayout();
  };
}
