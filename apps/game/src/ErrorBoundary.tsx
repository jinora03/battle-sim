import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Kinetic Battle Engine crashed', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <p className="eyebrow">Recovery screen</p>
        <h1>The Battle Lab could not start</h1>
        <p>{this.state.error.message}</p>
        <div className="fatal-error-actions">
          <button onClick={() => window.location.reload()}>Reload application</button>
          <button className="secondary" onClick={() => {
            window.localStorage.removeItem('kinetic.app-settings.v3');
            window.localStorage.removeItem('kinetic.app-settings.v2');
            window.location.reload();
          }}>Reset display settings</button>
        </div>
        <details><summary>Technical details</summary><pre>{this.state.error.stack}</pre></details>
      </main>
    );
  }
}
