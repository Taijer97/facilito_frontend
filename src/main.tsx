import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign Vite WebSocket errors in this environment
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && (
      (typeof event.reason === 'string' && event.reason.includes('WebSocket')) ||
      (event.reason.message && event.reason.message.includes('WebSocket')) ||
      (event.reason.message && event.reason.message.includes('vite'))
    )) {
      event.preventDefault();
    }
  });

  // Also suppress direct console errors from Vite WebSocket
  const originalError = console.error;
  console.error = (...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('vite'))) {
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
