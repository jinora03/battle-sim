import { useState, type ChangeEvent, type ReactNode, type SyntheticEvent } from 'react';


export function DisclosureGroup({
  eyebrow,
  title,
  summary,
  defaultOpen = false,
  className = '',
  children
}: {
  eyebrow: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={`disclosure-group ${className}`.trim()}
      open={open}
      onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}
    >
      <summary className="disclosure-group-summary">
        <span><small>{eyebrow}</small><strong>{title}</strong></span>
        {summary ? <em>{summary}</em> : null}
      </summary>
      <div className="disclosure-group-content">{children}</div>
    </details>
  );
}

export function CreatorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel-section creator-section"><h2>{title}</h2>{children}</section>;
}

export function CreatorField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="creator-field"><span>{label}</span>{children}</label>;
}

export function RangeField({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>{label}<strong>{formatNumber(value, step)}</strong></span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ColorField({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <input
        type="color"
        value={hexColor(value)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number.parseInt(event.target.value.slice(1), 16))}
      />
      <code>{hexColor(value)}</code>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function Metric({ label, value, mono = false }: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return <div className="metric"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>;
}

export function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function formatNumber(value: number, step: number): string {
  if (step >= 1) return value.toFixed(0);
  if (step >= 0.1) return value.toFixed(1);
  if (step >= 0.01) return value.toFixed(2);
  return value.toFixed(3);
}
