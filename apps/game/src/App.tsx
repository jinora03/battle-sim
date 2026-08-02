import { AppWorkspace } from './app/AppWorkspace';
import { useAppController } from './app/AppController';

export default function App() {
  const controller = useAppController();
  return <AppWorkspace controller={controller} />;
}
