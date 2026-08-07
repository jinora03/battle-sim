import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AiController } from '@kinetic/controllers';
import type { BattleDefinition } from '@kinetic/protocol';
import { ReplayRecorder } from '@kinetic/replay';
import { checksumSnapshot, LocalSimulationRunner } from '@kinetic/simulation';
import {
  ReplayFrameStepper,
  WebmMuxer,
  createStage810aExportSettings,
  estimateEncodedBytes,
  resolveEncoderConfig,
  validateExportPlan
} from '@kinetic/video-export';

const battle: BattleDefinition = {
  seed: 81001,
  arenaId: 'iron-pit',
  modeId: 'duel',
  participants: [
    { fighterId: 'frost-warden', team: 1, controller: 'ai', x: 190, y: 480 },
    { fighterId: 'rocket-vanguard', team: 2, controller: 'ai', x: 530, y: 480 }
  ],
  rules: { friendlyFire: false, teamCollision: 'ghost', maxBattleTicks: 1200 }
};

function recordReplay(ticks = 240) {
  const runner = new LocalSimulationRunner(battle);
  const ai = new AiController(false);
  const recorder = new ReplayRecorder(battle);
  for (let index = 0; index < ticks && !runner.getSnapshot().battleEnded; index += 1) {
    const snapshot = runner.getRuntimeSnapshot();
    const commands = ai.commandsForTick(snapshot);
    recorder.record(snapshot.tick, commands);
    runner.step(commands);
  }
  const snapshot = runner.getSnapshot();
  return {
    replay: recorder.export(),
    endTick: snapshot.tick,
    checksum: checksumSnapshot(snapshot)
  };
}

describe('Stage 8.10A replay video export foundation', () => {
  it('steps exactly one deterministic simulation tick per output frame', () => {
    const source = recordReplay();
    const stepper = new ReplayFrameStepper(source.replay, source.endTick, 60);
    let frames = 0;
    let previousTimestamp = -1;
    while (!stepper.done) {
      const frame = stepper.next();
      expect(frame).not.toBeNull();
      expect(frame!.frameIndex).toBe(frames);
      expect(frame!.snapshot.tick).toBe(frames + 1);
      expect(frame!.timestampUs).toBeGreaterThan(previousTimestamp);
      previousTimestamp = frame!.timestampUs;
      frames += 1;
    }
    expect(frames).toBe(source.endTick);
    expect(stepper.currentTick).toBe(source.endTick);
    expect(checksumSnapshot(stepper.finalSnapshot())).toBe(source.checksum);
  });

  it('locks Stage 8.10A to viewport-independent 1080p60 settings', () => {
    const settings = createStage810aExportSettings({
      maxDevicePixelRatio: 3,
      renderScale: 0.5,
      targetRenderFps: 30,
      adaptiveQuality: true,
      audio: true
    });
    expect(settings).toMatchObject({ width: 1920, height: 1080, fps: 60, bitrate: 12_000_000 });
    expect(settings.presentation).toMatchObject({
      maxDevicePixelRatio: 1,
      renderScale: 1,
      targetRenderFps: 60,
      adaptiveQuality: false,
      audio: false
    });
    expect(estimateEncodedBytes(settings, 60 * 60)).toBeGreaterThan(0);
    expect(() => validateExportPlan(settings, 180 * 60)).not.toThrow();
    expect(() => validateExportPlan(settings, 180 * 60 + 1)).toThrow(/duration/i);
  });

  it('falls back to browser-selected acceleration when hardware preference is unavailable', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'VideoEncoder');
    const attempted: string[] = [];
    Object.defineProperty(globalThis, 'VideoEncoder', {
      configurable: true,
      value: {
        isConfigSupported: async (config: VideoEncoderConfig) => {
          attempted.push(`${config.codec}:${config.hardwareAcceleration}`);
          return { supported: config.hardwareAcceleration === 'no-preference', config };
        }
      }
    });

    try {
      const resolved = await resolveEncoderConfig(createStage810aExportSettings({}));
      expect(resolved?.config.hardwareAcceleration).toBe('no-preference');
      expect(attempted).toEqual([
        'vp09.00.10.08:prefer-hardware',
        'vp8:prefer-hardware',
        'vp09.00.10.08:no-preference'
      ]);
    } finally {
      if (originalDescriptor) Object.defineProperty(globalThis, 'VideoEncoder', originalDescriptor);
      else Reflect.deleteProperty(globalThis, 'VideoEncoder');
    }
  });

  it('places the compact replay exporter below performance metrics', () => {
    const workspace = readFileSync(new URL('../apps/game/src/app/AppWorkspace.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../apps/game/src/styles/77-video-export.css', import.meta.url), 'utf8');
    expect(workspace.indexOf('<BattlePerformanceMetrics')).toBeLessThan(workspace.indexOf('<BattleVideoExport'));
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(styles).toContain('padding: 12px');
  });

  it('packages ordered VP8 samples into a WebM blob', async () => {
    const muxer = new WebmMuxer({
      width: 1920,
      height: 1080,
      fps: 60,
      codec: 'vp8',
      maxEncodedBytes: 1024 * 1024
    });
    muxer.addSample({ timestampUs: 0, durationUs: 16_667, keyFrame: true, data: Uint8Array.of(1, 2, 3) });
    muxer.addSample({ timestampUs: 16_667, durationUs: 16_667, keyFrame: false, data: Uint8Array.of(4, 5, 6) });
    const blob = muxer.finalize();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(blob.type).toBe('video/webm');
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    expect(text).toContain('webm');
    expect(text).toContain('V_VP8');
  });

  it('enforces encoded-memory safeguards while collecting chunks', () => {
    const muxer = new WebmMuxer({ width: 16, height: 16, fps: 60, codec: 'vp8', maxEncodedBytes: 4 });
    expect(() => muxer.addSample({
      timestampUs: 0,
      durationUs: 16_667,
      keyFrame: true,
      data: Uint8Array.of(1, 2, 3, 4, 5)
    })).toThrow(/memory safeguard/i);
  });

  it('uses a dedicated fixed renderer instead of real-time screen capture', () => {
    const exporter = readFileSync(new URL('../packages/video-export/src/replayVideoExporter.ts', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../packages/renderer-pixi/src/index.ts', import.meta.url), 'utf8');
    expect(exporter).toContain('new PixiBattleRenderer()');
    expect(exporter).toContain('setFixedOutputSize(arenaSize.width, arenaSize.height)');
    expect(exporter).toContain('new BroadcastFrameRenderer(settings, source.replay.battle)');
    expect(exporter).toContain('broadcastRenderer.render(');
    expect(exporter).toContain('renderer.destroy()');
    expect(exporter).toContain('host.remove()');
    expect(exporter).not.toContain('captureStream(');
    expect(exporter).not.toContain('MediaRecorder');
    expect(renderer).toContain('renderExportFrame(');
    expect(renderer).toContain('getCanvas()');
  });
});
