import './env'; // Polyfill for process.env

// One-time cleanup of stale localStorage keys removed in this version
['openai-organization-id', 'openai-project-id', 'bananyang-openai-usage-v1'].forEach(k => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
});

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeDisplayScaling } from './utils/displayScaling';

// Initialize display scaling based on screen resolution
const scaleInfo = initializeDisplayScaling();
console.log(`UI Scale: ${scaleInfo.scale}x for ${scaleInfo.description} (${scaleInfo.resolution})`);

import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* AuthGate: 구매 인증 전까지 App(작업 공간)을 잠금 */}
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </React.StrictMode>
);