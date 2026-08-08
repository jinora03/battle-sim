import type { ChangeEvent } from 'react';
import {
  formatBytes,
  getBroadcastLayout,
  listCreatorExportPresets,
  type BroadcastLayoutId,
  type SeedBatchSize,
  type VideoExportCameraMode,
  type VideoExportFormat,
  type VideoExportFrameRate,
  type VideoExportQuality,
  type VideoExportResolution
} from '@kinetic/video-export';
import type { ReplayVideoExportController, ReplayVideoSourceMode } from '../../hooks/useReplayVideoExport';
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
    capability, progress, seedProgress, batchProgress, batchSearching, batchSize, batchResults, preparingReplay, running, error,
    sourceMode, generationSeedText, preparedReplayTick,
    format, layout, resolution, fps, quality, audioEnabled, cameraMode,
    preset, introEnabled, captionsEnabled, thumbnailEnabled, history,
    setSourceMode, setGenerationSeedText, randomizeSeed, reuseCurrentSeed, setBatchSize, searchSeeds, selectRankedSeed,
    setFormat, setLayout, setResolution, setFps, setQuality, setAudioEnabled, setCameraMode,
    applyPreset, setIntroEnabled, setCaptionsEnabled, setThumbnailEnabled, clearHistory,
    start, cancel
  } = controller;
  const layoutDefinition = getBroadcastLayout(layout, resolution === '4k' ? 2 : 1);
  const sourceTick = sourceMode === 'current-replay' ? replayTick : preparedReplayTick;
  const durationSeconds = (sourceTick ?? 0) / 60;
  const exportDisabled = running || capability?.supported !== true || (sourceMode === 'current-replay' && replayTick <= 0);
  const status = capability === null
    ? 'Checking encoder…'
    : capability.supported
      ? `${capability.container?.toUpperCase()} · ${capability.codec?.toUpperCase()}${capability.audioCodec ? ` + ${capability.audioCodec.toUpperCase()}` : ''}`
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
            <span>{audioEnabled ? (capability?.audioCodec?.toUpperCase() ?? 'Audio') : 'Silent'}</span>
          </div>
          <span className={`video-export-capability ${capability?.supported ? 'ready' : capability ? 'blocked' : ''}`}>{status}</span>
        </div>

        <OptionPicker
          label="Replay source"
          value={sourceMode}
          disabled={running}
          options={[
            ['current-replay', 'Current replay', 'Use battle already run'],
            ['setup-seed', 'Setup + seed', 'Simulate offscreen']
          ] as const}
          onChange={(value) => setSourceMode(value as ReplayVideoSourceMode)}
        />

        {sourceMode === 'setup-seed' && (
          <div className="video-export-seed-source">
            <label>
              <span>Seed</span>
              <input
                value={generationSeedText}
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={running}
                aria-label="Seed for generated replay"
                onChange={(event) => setGenerationSeedText(event.target.value)}
              />
            </label>
            <div className="video-export-seed-actions">
              <button type="button" onClick={randomizeSeed} disabled={running}>Randomize</button>
              <button type="button" onClick={reuseCurrentSeed} disabled={running}>Reuse current</button>
            </div>
            <div className="video-export-seed-search">
              <label>
                <span>Search</span>
                <select
                  value={batchSize}
                  disabled={running}
                  onChange={(event) => setBatchSize(Number(event.target.value) as SeedBatchSize)}
                >
                  <option value={10}>10 seeds</option>
                  <option value={25}>25 seeds</option>
                  <option value={50}>50 seeds</option>
                </select>
              </label>
              <button type="button" onClick={batchSearching ? cancel : searchSeeds} disabled={running && !batchSearching}>
                {batchSearching ? 'Cancel search' : 'Find best seeds'}
              </button>
            </div>

            {batchProgress && (batchSearching || batchProgress.phase === 'complete' || batchProgress.phase === 'cancelled') && (
              <div className="video-export-progress video-export-batch-progress" role="status" aria-live="polite">
                <div className="video-export-progress-label">
                  <strong>{batchProgress.message}</strong>
                  <span>{Math.round(batchProgress.progress * 100)}%</span>
                </div>
                <div className="video-export-progress-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, batchProgress.progress * 100))}%` }} />
                </div>
                <div className="video-export-progress-meta">
                  <span>{batchProgress.completed} / {batchProgress.total} seeds</span>
                  {batchProgress.activeSeed !== null && <span>Seed {batchProgress.activeSeed.toLocaleString()}</span>}
                  {batchProgress.best && <span>Best {batchProgress.best.score}</span>}
                </div>
              </div>
            )}

            {batchResults.length > 0 && (
              <div className="video-export-seed-results" aria-label="Top ranked battle seeds">
                {batchResults.slice(0, 5).map((result) => {
                  const selected = Number(generationSeedText) === result.seed;
                  return (
                    <button
                      key={result.seed}
                      type="button"
                      className={selected ? 'selected' : ''}
                      onClick={() => selectRankedSeed(result.seed)}
                      disabled={running}
                    >
                      <strong>#{result.rank} · {result.score}</strong>
                      <span>Seed {result.seed.toLocaleString()}</span>
                      <small>{Math.round(result.metrics.durationSeconds)}s · {result.labels.join(' · ')}</small>
                    </button>
                  );
                })}
              </div>
            )}

            <small>Seed search simulates only deterministic battle metrics—no replay recording or video encoding. The selected seed is generated once when you export.</small>
          </div>
        )}

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
            <span>Format</span>
            <select value={format} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormat(event.target.value as VideoExportFormat)} disabled={running}>
              <option value="auto">Auto · MP4 preferred</option>
              <option value="mp4">MP4 · H.264/AAC</option>
              <option value="webm">WebM · VP9/VP8</option>
            </select>
          </label>
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

        <p className="video-export-note">Auto prefers H.264/AAC MP4 for broad upload compatibility and falls back to VP9/VP8 + Opus WebM when MP4 is unavailable.</p>

        <div className="video-export-facts" aria-label="Video export details">
          <span><small>Format</small><strong>{capability?.container?.toUpperCase() ?? format.toUpperCase()}</strong></span>
          <span><small>Duration</small><strong>{sourceTick === null ? 'Pending' : formatDuration(durationSeconds)}</strong></span>
          <span><small>Replay ticks</small><strong>{sourceTick === null ? 'Pending' : sourceTick.toLocaleString()}</strong></span>
          <span><small>Audio</small><strong>{audioEnabled ? 'Deterministic' : 'Disabled'}</strong></span>
          <span><small>Preset</small><strong>{quality}</strong></span>
          <span><small>Camera</small><strong>{cameraMode === 'cinematic' ? 'Cinematic' : 'Arena-wide'}</strong></span>
          <span><small>Canvas</small><strong>{layoutDefinition.width} × {layoutDefinition.height}</strong></span>
          <span><small>Creator cards</small><strong>{introEnabled ? 'Intro + summary' : 'Summary only'}</strong></span>
          <span><small>Thumbnail</small><strong>{thumbnailEnabled ? 'Auto highlight' : 'Disabled'}</strong></span>
        </div>

        {preparingReplay && seedProgress && (
          <div className="video-export-progress" role="status" aria-live="polite">
            <div className="video-export-progress-label">
              <strong>{seedProgress.message}</strong>
              <span>{Math.round(seedProgress.progress * 100)}%</span>
            </div>
            <div className="video-export-progress-track" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, seedProgress.progress * 100))}%` }} />
            </div>
            <div className="video-export-progress-meta">
              <span>{seedProgress.simulatedTicks.toLocaleString()} / {seedProgress.maxTicks.toLocaleString()} ticks</span>
              <span>Preparing battle replay</span>
            </div>
          </div>
        )}

        {!batchSearching && !preparingReplay && (running || progress.phase === 'complete' || progress.phase === 'cancelled' || progress.phase === 'error') && (
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

        {capability?.notice && !error && (
          <p className="video-export-note">{capability.notice}</p>
        )}

        {(error || capability?.reason) && (
          <p className="video-export-error" role="alert">{error ?? capability?.reason}</p>
        )}

        <div className="video-export-actions">
          <NeonButton tone="primary" size="small" fullWidth onClick={start} disabled={exportDisabled}>
            {batchSearching ? 'Searching seeds…' : preparingReplay ? 'Preparing replay…' : running ? 'Rendering video…' : sourceMode === 'setup-seed' ? 'Generate & export video' : 'Export current replay'}
          </NeonButton>
          {running && <NeonButton tone="danger" size="small" fullWidth onClick={cancel}>Cancel</NeonButton>}
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
                      <small>{entry.container?.toUpperCase() ?? 'VIDEO'} · {entry.layout} · {entry.resolution} · {entry.fps} FPS · {formatBytes(entry.encodedBytes)}</small>
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
