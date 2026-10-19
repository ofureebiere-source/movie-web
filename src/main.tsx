import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installFetchFailover } from '@/lib/config';
import './index.css';

// Installed before the first render so a catalogue request issued during mount
// already benefits from the multi-origin failover.
installFetchFailover();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
