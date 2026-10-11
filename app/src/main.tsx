import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ToastProvider } from './ui/Toast';
import { applyTheme, readTheme } from './lib/theme';
import './styles.css';

applyTheme(readTheme());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(readTheme()));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider><App /></ToastProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js'); });
}
