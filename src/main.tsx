import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { hydrateFromSupabase, installLocalStorageSync } from './lib/supabase.ts';
import './index.css';

// Safely install local storage sync without blocking render
try {
  installLocalStorageSync();
} catch (err) {
  console.warn('[Init] Local storage sync init deferred:', err);
}

// 1. Mount React application IMMEDIATELY so the user never sees a white page
const mountPoint = document.getElementById('root');
if (mountPoint) {
  try {
    const root = createRoot(mountPoint);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (mountErr) {
    console.error('[Init] Critical render failure:', mountErr);
    mountPoint.innerHTML = `
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;text-align:center;">
        <div style="width:54px;height:54px;background:#f59e0b;color:#0f172a;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:24px;margin-bottom:16px;">!</div>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;">Stanbax Schools Portal</h2>
        <p style="font-size:13px;color:#94a3b8;max-width:340px;margin-bottom:20px;">The application encountered a display launch issue. Tap below to reload fresh data.</p>
        <button onclick="window.location.reload(true)" style="background:#2563eb;color:#ffffff;border:none;padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;">Reload App</button>
      </div>
    `;
  }
}

// 2. Perform background hydration asynchronously with a strict 2.5-second timeout
// so slow mobile connections (e.g. MTN Nigeria LTE) never stall UI paint
void (async () => {
  try {
    await Promise.race([
      hydrateFromSupabase(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch (hydrErr) {
    console.warn('[Hydration] Background state sync completed or timed out:', hydrErr);
  }
})();
