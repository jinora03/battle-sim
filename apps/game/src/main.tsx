import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './styles.css';
import './styles/00-tokens.css';
import './styles/10-base.css';
import './styles/20-components.css';
import './styles/30-battle.css';
import './styles/40-mobile.css';
import './styles/50-refine.css';
import './styles/60-battle-intro.css';

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
