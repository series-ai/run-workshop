import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorApp } from './EditorApp';

const root = document.getElementById('root');
if (!root) throw new Error('editor: #root missing');
createRoot(root).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>,
);
