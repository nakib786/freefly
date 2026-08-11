/**
 * Entry for /credits. Separate document, separate bundle — see CreditsPage.tsx.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/martian-mono/wdth.css';

import { CreditsPage } from '@/credits/CreditsPage';
import '@/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CreditsPage />
  </StrictMode>,
);
