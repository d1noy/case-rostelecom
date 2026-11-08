import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure Leaflet global is attached so plugins (like leaflet.heat) initialize seamlessly
if (typeof window !== 'undefined') {
  (window as any).L = L;
}

import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
