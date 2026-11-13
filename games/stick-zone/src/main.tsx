import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { GameErrorBoundary } from './components/GameErrorBoundary.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameErrorBoundary>
      <App />
    </GameErrorBoundary>
  </React.StrictMode>,
);
