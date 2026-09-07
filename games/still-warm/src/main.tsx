import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initializeRun } from './agent/runtime';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(<App />);
void initializeRun()
  .then((run) => run.preloader.hideLoadScreen())
  .catch(() => {
    console.warn('RUN could not start. Rehearsal is available.');
  });
