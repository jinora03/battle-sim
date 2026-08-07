import type { ChangeEvent } from 'react';
import {
  formatBytes,
  getBroadcastLayout,
  type BroadcastLayoutId,
  type VideoExportFrameRate,
  type VideoExportQuality,
  type VideoExportResolution
} from '@kinetic/video-export';
import type { ReplayVideoExportController } from '../../hooks/useReplayVideoExport';
import { NeonButton } from '../../ui/NeonUI';

const BROADCAST_LAYOUT_OPTIONS = ['landscape', 'vertical'] as const;

export function BattleVideoExport({
  controller,
  replayTick
}: {
  controller: ReplayVideoExportController;
  replayTick: number;
}) {
  const {
    capability, progress, running, error,
    layout, resolution, fps, quality, audioEnabled,
    setLayout, setResolution, setFps, setQuality, setAudioEnabled,
    start, cancel
  } = controller;
  const layoutDefinition = getBroadcastLayout(layout, resolution === '4k' ? 2 : 1);
  const durationSeconds = replayTick / 60;
  const exportDisabled = running || replayTick <= 0 || capability?.supported !== true;
  const status = capability === null
    ? 'Checking encoder…'
    : capability.supported
      ? `${capability.codec?.toUpperCase()}${capability.audioCodec ? ' + OPUS' : ''} ready`
      : 'Unavailable';

  return (
    <details className="panel-section battle-video-export" open>
      <summary className="panel-summary">
        <span><small>Creator export</small><strong>Replay video</strong></span>
        <em>{resolution} · {fps}</em>
      </summary>

      <div className="video-export-content">
        <div className="video-export-status-row">
          <div className="video-export-format" aria-label="Export format">
            <span>{layoutDefinition.aspectLabel}</span>
            <span>{resolution}</span>
            <span>{fps} FPS</span>
            <span>{audioEnabled ? 'Opus audio' : 'Silent'}</span>
          </div>
          <span className={`video-export-capability ${capability?.supported ? 'ready' : capability ? 'blocked' : ''}`}>{status}</span>
        </div>

        <OptionPicker
          label="Broadcast layout"
          value={layout}
          disabled={running}
          options={BROADCAST_LAYOUT_OPTIONS.map((option) => option === 'landscape'
            ? [option, 'Landscape', '16:9 YouTube'] as const
            : [option, 'Vertical', '9:16 Shorts'] as const)}
          onChange={(value) => setLayout(value as BroadcastLayoutId)}
        />

        <div className="video-export-compact-options">
          <label>
            <span>Resolution</span>
            <select value={resolution} onChange={(event: ChangeEvent<HTMLSelectElement>) => setResolution(event.target.value as VideoExportResolution)} disabled={running}>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </label>
          <label>
            <span>Frame rate</span>
            <select value={fps} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFps(Number(event.target.value) as VideoExportFrameRate)} disabled={running}>
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </label>
          <label>
            <span>Quality</span>
            <select value={quality} onChange={(event: ChangeEvent<HTMLSelectElement>) => setQuality(event.target.value as VideoExportQuality)} disabled={running}>
              <option value="balanced">Balanced</option>
              <option value="high">High</option>
              <option value="maximum">Maximum</option>
            </select>
          </label>
          <label className="video-export-audio-toggle">
            <span>Audio</span>
            <button type="button" className={audioEnabled ? 'selected' : ''} onClick={() => setAudioEnabled(!audioEnabled)} disabled={running}>
              {audioEnabled ? 'On' : 'Off'}
            </button>
          </label>
        </div>

        <p className="video-export-note">Replay-timestamped broadcast video with deterministic synthesized combat audio. 4K support depends on your browser, GPU, and available memory.</p>

        <div className="video-export-facts" aria-label="Video export details">
          <span><small>Duration</small><strong>{formatDuration(durationSeconds)}</strong></span>
          <span><small>Replay ticks</small><strong>{replayTick.toLocaleString()}</strong></span>
          <span><small>Audio</small><strong>{audioEnabled ? 'Deterministic' : 'Disabled'}</strong></span>
          <span><small>Preset</small><strong>{quality}</strong></span>
          <span><small>Canvas</small><strong>{layoutDefinition.width} × {layoutDefinition.height}</strong></span>
        </div>

        {(running || progress.phase === 'complete' || progress.phase === 'cancelled' || progress.phase === 'error') && (
          <div className="video-export-progress" role="status" aria-live="polite">
            <div className="video-export-progress-label">
              <strong>{progress.message}</strong>
              <span>{Math.round(progress.progress * 100)}%</span>
            </div>
            <div className="video-export-progress-track" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, progress.progress * 100))}%` }} />
            </div>
            <div className="video-export-progress-meta">
              <span>{progress.renderedFrames.toLocaleString()} / {progress.totalFrames.toLocaleString()} frames</span>
              <span>{progress.estimatedRemainingMs === null ? progress.phase === 'audio' ? 'Encoding audio…' : 'Estimating…' : `${formatDuration(progress.estimatedRemainingMs / 1000)} left`}</span>
              <span>{formatBytes(progress.encodedBytes)}</span>
            </div>
          </div>
        )}

        {(error || capability?.reason) && (
          <p className="video-export-error" role="alert">{error ?? capability?.reason}</p>
        )}

        <div className="video-export-actions">
          <NeonButton tone="primary" size="small" fullWidth onClick={start} disabled={exportDisabled}>
            {running ? 'Exporting replay…' : 'Export current replay'}
          </NeonButton>
          {running && <NeonButton tone="danger" size="small" fullWidth onClick={cancel}>Cancel export</NeonButton>}
          <small>4K, 30/60 FPS, quality presets, and deterministic Opus audio are active in Stage 8.10C.</small>
        </div>
      </div>
    </details>
  );
}

function OptionPicker({
  label,
  value,
  disabled,
  options,
  onChange
}: {
  label: string;
  value: string;
  disabled: boolean;
  options: readonly (readonly [string, string, string])[];
  onChange(value: string): void;
}) {
  return (
    <div className="video-export-layout-picker" role="group" aria-label={label}>
      {options.map(([option, title, detail]) => (
        <button key={option} type="button" className={value === option ? 'selected' : ''} onClick={() => onChange(option)} disabled={disabled}>
          <strong>{title}</strong>
          <small>{detail}</small>
        </button>
      ))}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const rounded = Math.ceil(seconds);
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, '0')}`;
}
