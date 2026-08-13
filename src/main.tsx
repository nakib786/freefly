import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted variable fonts. The `wdth` cuts carry both the weight and width
// axes, which the type system in index.css depends on. Archivo's expanded
// headlines and Martian Mono's condensed telemetry are width-axis settings, and
// the wght-only files would silently render at normal width.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/martian-mono/wdth.css';

import App from '@/App';
import '@/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
