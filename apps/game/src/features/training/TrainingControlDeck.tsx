import type { PointerEvent as ReactPointerEvent } from 'react';
import type { AbilitySlot, Vec2 } from '@kinetic/protocol';

export interface TrainingSlotControl {
  slot: AbilitySlot;
  label: string;
  name: string;
  status: string;
  available: boolean;
  selected: boolean;
}

interface TrainingControlDeckProps {
  slots: readonly TrainingSlotControl[];
  onSelect(slot: AbilitySlot): void;
  onMove(direction: Vec2): void;
}

export function TrainingControlDeck({ slots, onSelect, onMove }: TrainingControlDeckProps) {
  return (
    <div className="training-control-surface">
      <TrainingDirectionalPad onMove={onMove} />
      <div className="training-slot-scroll" role="tablist" aria-label="Ability Lab skills">
        {slots.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={item.selected}
            key={item.slot}
            className={`training-slot ${item.selected ? 'selected' : ''}`}
            onClick={() => onSelect(item.slot)}
            disabled={!item.available}
          >
            <small>{item.label}</small>
            <strong>{item.name}</strong>
            <span>{item.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TrainingDirectionalPad({ onMove }: { onMove(direction: Vec2): void }) {
  const start = (direction: Vec2) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onMove(direction);
  };
  const stop = () => onMove({ x: 0, y: 0 });

  return (
    <div className="training-direction-pad" aria-label="Training movement controls">
      <button type="button" className="up" aria-label="Move up" onPointerDown={start({ x: 0, y: -1 })} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>↑</button>
      <button type="button" className="left" aria-label="Move left" onPointerDown={start({ x: -1, y: 0 })} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>←</button>
      <span aria-hidden="true" />
      <button type="button" className="right" aria-label="Move right" onPointerDown={start({ x: 1, y: 0 })} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>→</button>
      <button type="button" className="down" aria-label="Move down" onPointerDown={start({ x: 0, y: 1 })} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>↓</button>
    </div>
  );
}
