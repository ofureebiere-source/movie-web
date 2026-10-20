import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installFetchFailover } from '@/lib/config';
import { installSegmentCacheSweep } from '@/lib/segmentCache';
import { installDevtoolsGuard } from '@/lib/antiDevtools';
import './index.css';

// Installed before the first render so a catalogue request issued during mount
// already benefits from the multi-origin failover, and so any media cached on a
// previous visit is swept for expiry before playback can read a stale entry.
installFetchFailover();
installSegmentCacheSweep();
installDevtoolsGuard();

// The service worker caches the app shell and artwork only — never playback
// traffic (see public/sw.js). Registered after load so it never competes with
// the first paint, and a failure is non-fatal.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
