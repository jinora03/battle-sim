import type { ChangeEvent, MouseEvent } from 'react';
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
import { requestDeveloperAccess } from '../../developerAccess';
import { NeonButton } from '../../ui/NeonUI';

const BROADCAST_LAYOUT_OPTIONS = ['landscape', 'vertical'] as const;

export function BattleVideoExport({
  controller,
  replayTick,
  battleEnded
}: {
  controller: ReplayVideoExportController;
  replayTick: number;
  battleEnded: boolean;
}) {
  const {
    capability, deviceProfile, memoryForecast, progress, seedProgress, batchProgress, batchSearching, batchSize, batchResults,
    queueItems, queueRunning, queuePackaging, queueMessage, preparingReplay, running, error,
    sourceMode, generationSeedText, preparedReplayTick,
    format, layout, resolution, fps, quality, audioEnabled, cameraMode, cameraShakeEnabled, screenFlashEnabled,
    preset, introEnabled, highlightsEnabled, captionsEnabled, thumbnailEnabled, autoDownloadEnabled, directDownload, history,
    setSourceMode, setGenerationSeedText, randomizeSeed, reuseCurrentSeed, setBatchSize, searchSeeds, selectRankedSeed,
    addToQueue, queueTopRankedSeeds, startQueue, removeQueueItem, retryQueueItem, downloadQueueItem, downloadQueueArchive, clearQueue,
    setFormat, setLayout, setResolution, setFps, setQuality, setAudioEnabled, setCameraMode, setCameraShakeEnabled, setScreenFlashEnabled,
    applyPreset, setIntroEnabled, setHighlightsEnabled, setCaptionsEnabled, setThumbnailEnabled, setAutoDownloadEnabled,
    downloadLatest, downloadLatestThumbnail, clearHistory,
    start, cancel
  } = controller;
  const layoutDefinition = getBroadcastLayout(layout, resolution === '4k' ? 2 : 1);
  const sourceTick = sourceMode === 'current-replay' ? replayTick : preparedReplayTick;
  const durationSeconds = (sourceTick ?? 0) / 60;
  const currentReplayReady = replayTick > 0 && battleEnded;
  const selectedSourceReady = sourceMode === 'setup-seed' || currentReplayReady;
  const exportDisabled = running || capability?.supported !== true || !selectedSourceReady;
  const queuedCount = queueItems.filter((item) => item.status === 'queued').length;
  const completedQueueCount = queueItems.filter((item) => item.status === 'complete').length;
  const queueAddDisabled = exportDisabled || queueItems.length >= 8;
  const status = capability === null
    ? 'Checking encoder…'
    : capability.supported
      ? `${capability.container?.toUpperCase()} · ${capability.codec?.toUpperCase()}${capability.audioCodec ? ` + ${capability.audioCodec.toUpperCase()}` : ''}`
      : 'Unavailable';
  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    const details = event.currentTarget.parentElement as HTMLDetailsElement | null;
    if (!details) return;
    event.preventDefault();
    if (details.open) {
      details.open = false;
      return;
    }
    if (requestDeveloperAccess('Replay video export')) details.open = true;
  };

  return (
    <details className="panel-section battle-video-export">
      <summary className="panel-summary" onClick={handleSummaryClick}>
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
            ['current-replay', 'Arena replay', 'Completed battle on screen'],
            ['setup-seed', 'Setup + seed', 'Generate a separate battle']
          ] as const}
          onChange={(value) => setSourceMode(value as ReplayVideoSourceMode)}
        />

        <div className={`video-export-source-identity ${sourceMode === 'current-replay' ? (currentReplayReady ? 'ready' : 'recording') : (preparedReplayTick ? 'ready' : 'pending')}`}>
          {sourceMode === 'current-replay' ? (
            <>
              <div>
                <small>ARENA REPLAY</small>
                <strong>{currentReplayReady ? 'Completed battle currently shown in the arena' : replayTick > 0 ? 'Current arena battle is still recording' : 'No arena replay yet'}</strong>
              </div>
              <span>{replayTick > 0 ? `${formatDuration(replayTick / 60)} · ${replayTick.toLocaleString()} ticks` : 'Start a battle first'}</span>
              <p>{currentReplayReady ? 'Exports the finished battle you just watched. It will not change if you edit the setup below.' : 'Finish the live battle before exporting this source, so you never accidentally save a partial fight.'}</p>
            </>
          ) : (
            <>
              <div>
                <small>GENERATED SEED REPLAY</small>
                <strong>{preparedReplayTick ? 'Generated replay ready to reuse' : 'A new completed battle will be simulated offscreen'}</strong>
              </div>
              <span>Seed {Number(generationSeedText || 0).toLocaleString()}{preparedReplayTick ? ` · ${formatDuration(preparedReplayTick / 60)}` : ''}</span>
              <p>This is separate from the battle currently visible in the arena. The same generated replay is reused across export variants.</p>
            </>
          )}
        </div>

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

            {batchResults.length > 0 && (
              <button type="button" className="video-export-queue-ranked" onClick={queueTopRankedSeeds} disabled={running || queueItems.length >= 8}>
                Queue top 3 for export
              </button>
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
          <ToggleOption label="Camera shake" enabled={cameraShakeEnabled} disabled={running} onChange={setCameraShakeEnabled} />
          <ToggleOption label="Screen flashes" enabled={screenFlashEnabled} disabled={running} onChange={setScreenFlashEnabled} />
          <ToggleOption label="Intro" enabled={introEnabled} disabled={running} onChange={setIntroEnabled} />
          <ToggleOption
            label="Highlights"
            enabled={highlightsEnabled}
            disabled={running || cameraMode !== 'cinematic'}
            onChange={setHighlightsEnabled}
          />
          <ToggleOption label="Captions" enabled={captionsEnabled} disabled={running} onChange={setCaptionsEnabled} />
          <ToggleOption label="Thumbnail" enabled={thumbnailEnabled} disabled={running} onChange={setThumbnailEnabled} />
        </div>

        <div className="video-export-delivery">
          <div>
            <strong>Download delivery</strong>
            <small>
              {autoDownloadEnabled
                ? 'Automatically send completed single exports to the browser.'
                : 'Keep completed single exports ready until you press Download video.'}
            </small>
          </div>
          <ToggleOption label="Auto download" enabled={autoDownloadEnabled} disabled={running} onChange={setAutoDownloadEnabled} />
        </div>

        <p className="video-export-note">Auto prefers H.264/AAC MP4 for broad upload compatibility and falls back to VP9/VP8 + Opus WebM when MP4 is unavailable. Queue downloads always stay manual so the browser is not flooded with download prompts.</p>

        {memoryForecast && memoryForecast.risk !== 'low' && (
          <p className={`video-export-reliability risk-${memoryForecast.risk}`}>
            {memoryForecast.notice} If the encoder fails, the same replay will retry with safer codec/quality settings automatically.
          </p>
        )}

        <div className="video-export-facts" aria-label="Video export details">
          <span><small>Format</small><strong>{capability?.container?.toUpperCase() ?? format.toUpperCase()}</strong></span>
          <span><small>Duration</small><strong>{sourceTick === null ? 'Pending' : formatDuration(durationSeconds)}</strong></span>
          <span><small>Replay ticks</small><strong>{sourceTick === null ? 'Pending' : sourceTick.toLocaleString()}</strong></span>
          <span><small>Audio</small><strong>{audioEnabled ? 'Deterministic' : 'Disabled'}</strong></span>
          <span><small>Preset</small><strong>{quality}</strong></span>
          <span><small>Camera</small><strong>{cameraMode === 'cinematic' ? 'Cinematic' : 'Arena-wide'}</strong></span>
          <span><small>Shake</small><strong>{cameraShakeEnabled ? 'On · live intensity' : 'Off'}</strong></span>
          <span><small>Screen flash</small><strong>{screenFlashEnabled ? 'On' : 'Off'}</strong></span>
          <span><small>Canvas</small><strong>{layoutDefinition.width} × {layoutDefinition.height}</strong></span>
          <span>
            <small>Memory forecast</small>
            <strong className={memoryForecast ? `risk-${memoryForecast.risk}` : ''}>
              {memoryForecast ? `${formatBytes(memoryForecast.estimatedPeakBytes)} · ${memoryForecast.risk}` : 'Pending replay'}
            </strong>
          </span>
          <span>
            <small>Device budget</small>
            <strong>{deviceProfile.deviceMemoryGiB ? `${deviceProfile.deviceMemoryGiB} GB RAM` : 'RAM unknown'}{deviceProfile.hardwareConcurrency ? ` · ${deviceProfile.hardwareConcurrency} threads` : ''}</strong>
          </span>
          <span><small>Creator cards</small><strong>{introEnabled ? 'Who Will Win intro + victory card' : 'Victory card only'}</strong></span>
          <span><small>Highlights</small><strong>{cameraMode !== 'cinematic' ? 'Cinematic only' : highlightsEnabled ? 'Automatic' : 'Disabled'}</strong></span>
          <span><small>Thumbnail</small><strong>{thumbnailEnabled ? 'Auto highlight' : 'Disabled'}</strong></span>
          <span><small>Delivery</small><strong>{autoDownloadEnabled ? 'Auto download' : 'Manual download'}</strong></span>
        </div>

        <details className="video-export-queue">
          <summary>
            <span>Export queue</span>
            <em>{queueItems.length}/8</em>
          </summary>
          <div className="video-export-queue-content">
            <div className="video-export-queue-actions">
              <button type="button" onClick={addToQueue} disabled={queueAddDisabled}>Add current settings</button>
              <button type="button" onClick={startQueue} disabled={running || queuedCount === 0}>
                {queueRunning ? 'Running queue…' : `Run queue${queuedCount > 0 ? ` (${queuedCount})` : ''}`}
              </button>
              <button type="button" onClick={downloadQueueArchive} disabled={running || completedQueueCount === 0}>
                {queuePackaging ? 'Packaging…' : `Download ZIP${completedQueueCount > 0 ? ` (${completedQueueCount})` : ''}`}
              </button>
            </div>

            {queueMessage && <p className="video-export-queue-message">{queueMessage}</p>}

            {queueItems.length === 0 ? (
              <p className="video-export-queue-empty">Add the current source/settings, change the output format if needed, then add another variant.</p>
            ) : (
              <div className="video-export-queue-list">
                {queueItems.map((item, index) => (
                  <article key={item.id} className={`status-${item.status}`}>
                    <div className="video-export-queue-item-main">
                      <strong>#{index + 1} · {item.sourceLabel}</strong>
                      <small>
                        {item.settings.layout} · {item.settings.resolution} · {item.settings.fps} FPS · {item.settings.format.toUpperCase()} · {item.settings.camera.mode === 'cinematic' ? 'Cinematic' : 'Arena-wide'}
                      </small>
                      <span>{item.message}</span>
                    </div>
                    <div className="video-export-queue-item-status">
                      <em>{queueStatusLabel(item.status)}</em>
                      {item.encodedBytes > 0 && <small>{formatBytes(item.encodedBytes)}</small>}
                    </div>
                    {(item.status === 'preparing' || item.status === 'rendering') && (
                      <div className="video-export-progress-track" aria-hidden="true">
                        <span style={{ width: `${Math.max(0, Math.min(100, item.progress * 100))}%` }} />
                      </div>
                    )}
                    <div className="video-export-queue-item-actions">
                      {item.status === 'complete' && (
                        <button type="button" onClick={() => downloadQueueItem(item.id)}>Download</button>
                      )}
                      {(item.status === 'error' || item.status === 'cancelled') && (
                        <button type="button" onClick={() => retryQueueItem(item.id)} disabled={running}>Retry</button>
                      )}
                      {item.status !== 'preparing' && item.status !== 'rendering' && (
                        <button type="button" onClick={() => removeQueueItem(item.id)} disabled={running}>Remove</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {queueItems.length > 0 && (
              <button type="button" className="video-export-queue-clear" onClick={clearQueue} disabled={running}>Clear queue</button>
            )}
            <small>Queue encoding is sequential. A replay is generated once per unique source and reused across variants; failed encodes can automatically retry or fall back without resimulating.</small>
          </div>
        </details>

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

        {!batchSearching && !queueRunning && !queuePackaging && !preparingReplay && (running || progress.phase === 'complete' || progress.phase === 'cancelled' || progress.phase === 'error') && (
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
              <span>{progressStageDetail(progress)}</span>
              <span>{formatBytes(progress.encodedBytes)}</span>
            </div>
          </div>
        )}

        {directDownload.status !== 'idle' && (
          <div className={`video-export-download status-${directDownload.status}`} role="status" aria-live="polite">
            <div className="video-export-download-copy">
              <small>{directDownloadStatusLabel(directDownload.status)}</small>
              <strong>{directDownload.filename ?? 'Completed export'}</strong>
              <span>{directDownload.message}</span>
              {directDownload.encodedBytes > 0 && <em>{formatBytes(directDownload.encodedBytes)}</em>}
            </div>
            <div className="video-export-download-actions">
              <button
                type="button"
                onClick={downloadLatest}
                disabled={directDownload.status === 'requesting'}
              >
                {directDownload.status === 'requesting' ? 'Sending…' : directDownload.status === 'requested' ? 'Download again' : 'Download video'}
              </button>
              {directDownload.thumbnailFilename && (
                <button type="button" onClick={downloadLatestThumbnail} disabled={directDownload.status === 'requesting'}>
                  Download thumbnail
                </button>
              )}
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
          <div className="video-export-primary-actions">
            <NeonButton
              tone={sourceMode === 'current-replay' ? 'primary' : 'ghost'}
              size="small"
              fullWidth
              onClick={() => { setSourceMode('current-replay'); start('current-replay'); }}
              disabled={running || capability?.supported !== true || !currentReplayReady}
            >
              Export finished arena replay
            </NeonButton>
            <NeonButton
              tone={sourceMode === 'setup-seed' ? 'primary' : 'utility'}
              size="small"
              fullWidth
              onClick={() => { setSourceMode('setup-seed'); start('setup-seed'); }}
              disabled={running || capability?.supported !== true}
            >
              Generate seed replay & export
            </NeonButton>
          </div>
          {!currentReplayReady && replayTick > 0 && !running && (
            <small className="video-export-live-warning">Arena replay is recording now. The seed export is still available because it runs a separate battle offscreen.</small>
          )}
          {running && progress.phase !== 'downloading' && <NeonButton tone="danger" size="small" fullWidth onClick={cancel}>Cancel</NeonButton>}
          <small>Choose exactly which replay source to export. Rendering, finalization, packaging and download handoff are shown separately, and presentation never changes simulation outcomes.</small>
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

function progressStageDetail(progress: ReplayVideoExportController['progress']): string {
  if (progress.phase === 'audio') return 'Encoding audio…';
  if (progress.phase === 'finalizing') return 'Flushing encoder buffers…';
  if (progress.phase === 'muxing') return 'Packaging final file…';
  if (progress.phase === 'downloading') return 'Sending to browser…';
  if (progress.estimatedRemainingMs !== null) return `${formatDuration(progress.estimatedRemainingMs / 1000)} left`;
  if (progress.phase === 'complete') return 'Ready';
  return 'Estimating…';
}

function directDownloadStatusLabel(status: ReplayVideoExportController['directDownload']['status']): string {
  if (status === 'requesting') return 'Sending download';
  if (status === 'requested') return 'Download requested';
  return 'Ready to download';
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

function queueStatusLabel(status: string): string {
  if (status === 'preparing') return 'Preparing';
  if (status === 'rendering') return 'Rendering';
  if (status === 'complete') return 'Ready';
  if (status === 'error') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Queued';
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
