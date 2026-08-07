import type { ChangeEvent } from 'react';
import {
  formatBytes,
  getBroadcastLayout,
  listCreatorExportPresets,
  type BroadcastLayoutId,
  type VideoExportCameraMode,
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
    layout, resolution, fps, quality, audioEnabled, cameraMode,
    preset, introEnabled, captionsEnabled, thumbnailEnabled, history,
    setLayout, setResolution, setFps, setQuality, setAudioEnabled, setCameraMode,
    applyPreset, setIntroEnabled, setCaptionsEnabled, setThumbnailEnabled, clearHistory,
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
            <span>{cameraMode === 'cinematic' ? 'Cinematic' : 'Broadcast'}</span>
            <span>{audioEnabled ? 'Opus audio' : 'Silent'}</span>
          </div>
          <span className={`video-export-capability ${capability?.supported ? 'ready' : capability ? 'blocked' : ''}`}>{status}</span>
        </div>

        <label className="video-export-preset-picker">
          <span>Creator preset</span>
          <select
            value={preset}
            disabled={running}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const value = event.target.value;
              if (value !== 'custom') applyPreset(value as Exclude<typeof preset, 'custom'>);
            }}
          >
            {listCreatorExportPresets().map((option) => (
              <option key={option.id} value={option.id}>{option.name} · {option.detail}</option>
            ))}
            <option value="custom">Custom settings</option>
          </select>
        </label>

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
          <label>
            <span>Camera</span>
            <select value={cameraMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setCameraMode(event.target.value as VideoExportCameraMode)} disabled={running}>
              <option value="cinematic">Cinematic</option>
              <option value="broadcast">Arena-wide</option>
            </select>
          </label>
          <label className="video-export-audio-toggle">
            <span>Audio</span>
            <button type="button" className={audioEnabled ? 'selected' : ''} onClick={() => setAudioEnabled(!audioEnabled)} disabled={running}>
              {audioEnabled ? 'On' : 'Off'}
            </button>
          </label>
          <ToggleOption label="Intro" enabled={introEnabled} disabled={running} onChange={setIntroEnabled} />
          <ToggleOption label="Captions" enabled={captionsEnabled} disabled={running} onChange={setCaptionsEnabled} />
          <ToggleOption label="Thumbnail" enabled={thumbnailEnabled} disabled={running} onChange={setThumbnailEnabled} />
        </div>

        <p className="video-export-note">Creator presets add a matchup intro, automatic highlight selection, winner statistics, and an optional PNG thumbnail without changing replay outcomes.</p>

        <div className="video-export-facts" aria-label="Video export details">
          <span><small>Duration</small><strong>{formatDuration(durationSeconds)}</strong></span>
          <span><small>Replay ticks</small><strong>{replayTick.toLocaleString()}</strong></span>
          <span><small>Audio</small><strong>{audioEnabled ? 'Deterministic' : 'Disabled'}</strong></span>
          <span><small>Preset</small><strong>{quality}</strong></span>
          <span><small>Camera</small><strong>{cameraMode === 'cinematic' ? 'Cinematic' : 'Arena-wide'}</strong></span>
          <span><small>Canvas</small><strong>{layoutDefinition.width} × {layoutDefinition.height}</strong></span>
          <span><small>Creator cards</small><strong>{introEnabled ? 'Intro + summary' : 'Summary only'}</strong></span>
          <span><small>Thumbnail</small><strong>{thumbnailEnabled ? 'Auto highlight' : 'Disabled'}</strong></span>
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
          <small>Cinematic framing stays export-only and never changes replay simulation outcomes.</small>
        </div>

        <details className="video-export-history">
          <summary>
            <span>Export history</span>
            <em>{history.length}</em>
          </summary>
          <div className="video-export-history-content">
            {history.length === 0
              ? <p>No completed exports recorded on this device.</p>
              : history.slice(0, 5).map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.winnerName}</strong>
                      <small>{entry.layout} · {entry.resolution} · {entry.fps} FPS · {formatBytes(entry.encodedBytes)}</small>
                    </div>
                    <time dateTime={entry.createdAt}>{formatHistoryDate(entry.createdAt)}</time>
                    {entry.highlight && <span>{entry.highlight}</span>}
                  </article>
                ))}
            {history.length > 0 && (
              <button type="button" onClick={clearHistory} disabled={running}>Clear history</button>
            )}
          </div>
        </details>
      </div>
    </details>
  );
}

function ToggleOption({
  label,
  enabled,
  disabled,
  onChange
}: {
  label: string;
  enabled: boolean;
  disabled: boolean;
  onChange(enabled: boolean): void;
}) {
  return (
    <label className="video-export-audio-toggle">
      <span>{label}</span>
      <button type="button" className={enabled ? 'selected' : ''} onClick={() => onChange(!enabled)} disabled={disabled}>
        {enabled ? 'On' : 'Off'}
      </button>
    </label>
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

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
