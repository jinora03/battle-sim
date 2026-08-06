import { formatBytes } from '@kinetic/video-export';
import type { ReplayVideoExportController } from '../../hooks/useReplayVideoExport';
import { NeonButton } from '../../ui/NeonUI';

export function BattleVideoExport({
  controller,
  replayTick
}: {
  controller: ReplayVideoExportController;
  replayTick: number;
}) {
  const { capability, progress, running, error, start, cancel } = controller;
  const durationSeconds = replayTick / 60;
  const exportDisabled = running || replayTick <= 0 || capability?.supported !== true;
  const status = capability === null
    ? 'Checking encoder…'
    : capability.supported
      ? `${capability.codec?.toUpperCase()} ready`
      : 'Unavailable';

  return (
    <details className="panel-section battle-video-export" open>
      <summary className="panel-summary">
        <span><small>Creator export</small><strong>Replay video</strong></span>
        <em>1080p60</em>
      </summary>

      <div className="video-export-content">
        <div className="video-export-status-row">
          <div className="video-export-format" aria-label="Export format">
            <span>1080p</span>
            <span>60 FPS</span>
            <span>WebM</span>
          </div>
          <span className={`video-export-capability ${capability?.supported ? 'ready' : capability ? 'blocked' : ''}`}>{status}</span>
        </div>

        <p className="video-export-note">Fixed-frame replay rendering on a dedicated viewport-independent canvas.</p>

        <div className="video-export-facts" aria-label="Video export details">
          <span><small>Duration</small><strong>{formatDuration(durationSeconds)}</strong></span>
          <span><small>Frames</small><strong>{replayTick.toLocaleString()}</strong></span>
          <span><small>Audio</small><strong>8.10C</strong></span>
          <span><small>Canvas</small><strong>1920 × 1080</strong></span>
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
              <span>{progress.estimatedRemainingMs === null ? 'Estimating…' : `${formatDuration(progress.estimatedRemainingMs / 1000)} left`}</span>
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
          <small>Video only for Stage 8.10A. The live battle renderer stays independent.</small>
        </div>
      </div>
    </details>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const rounded = Math.ceil(seconds);
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, '0')}`;
}
