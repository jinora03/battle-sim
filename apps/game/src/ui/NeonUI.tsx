import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode
} from 'react';

export type NeonTone =
  | 'primary'
  | 'success'
  | 'random'
  | 'pause'
  | 'danger'
  | 'utility'
  | 'ghost'
  | 'ultimate';

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: NeonTone;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export function NeonButton({
  tone = 'primary',
  size = 'medium',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}: NeonButtonProps) {
  return (
    <button
      type={type}
      className={`ui-button ui-tone-${tone} ui-size-${size}${fullWidth ? ' ui-full-width' : ''}${className ? ` ${className}` : ''}`}
      {...props}
    />
  );
}

export interface NavigationItem<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
  shortLabel?: string;
}

export function AppNavigation<T extends string>({
  value,
  items,
  onChange,
  className = ''
}: {
  value: T;
  items: NavigationItem<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <nav className={`mode-tabs release-nav ui-app-navigation${className ? ` ${className}` : ''}`} aria-label="Game navigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={value === item.id ? 'active' : ''}
          aria-current={value === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className="ui-nav-label">{item.shortLabel ?? item.label}</span>
          {item.badge !== undefined && <b className="ui-nav-badge">{item.badge}</b>}
        </button>
      ))}
    </nav>
  );
}

export function DrawerScrim({
  open,
  onClose,
  label = 'Close panel',
  className = ''
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`ui-drawer-scrim${open ? ' open' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
      aria-hidden={!open}
      tabIndex={open ? 0 : -1}
      onClick={onClose}
    />
  );
}

export function DrawerHeader({
  eyebrow,
  title,
  onClose
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="ui-drawer-header">
      <div><small>{eyebrow}</small><strong>{title}</strong></div>
      <NeonButton tone="ghost" size="small" onClick={onClose} aria-label={`Close ${title}`}>×</NeonButton>
    </div>
  );
}

export function PanelTitle({
  eyebrow,
  title,
  description,
  action,
  className = ''
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-panel-title${className ? ` ${className}` : ''}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="ui-panel-title-action">{action}</div>}
    </div>
  );
}

export function GlassSurface({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div className={`ui-glass-surface${className ? ` ${className}` : ''}`} {...props}>{children}</div>;
}
