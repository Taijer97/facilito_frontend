import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign Vite WebSocket errors in this environment
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && (
      (typeof event.reason === 'string' && event.reason.includes('WebSocket')) ||
      (event.reason.message && event.reason.message.includes('WebSocket'))
    )) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
