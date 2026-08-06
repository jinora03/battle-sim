export function LandscapeHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="landscape-hint-badge" role="note" aria-label="Landscape view suggestion">
      <span className="landscape-hint-icon" aria-hidden="true">
        <i className="landscape-hint-phone" />
        <i className="landscape-hint-arrow">↻</i>
      </span>
      <span className="landscape-hint-copy">
        <strong>More room in landscape</strong>
        <small>Rotate your phone for a wider arena and clearer battle controls.</small>
      </span>
      <button type="button" className="landscape-hint-dismiss" onClick={onDismiss} aria-label="Dismiss landscape suggestion">Got it</button>
    </div>
  );
}
