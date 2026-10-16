import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Suppress harmless Vite HMR WebSocket disconnection errors in iframe environment
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    const reason = String(e.reason?.message || e.reason || '');
    if (
      reason.includes('WebSocket') ||
      reason.includes('ws://') ||
      reason.includes('wss://') ||
      reason.includes('@vite/client')
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
