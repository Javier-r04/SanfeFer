import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './styles/index.css';
import './stores/theme';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { Toaster } from './components/ui/Toaster';
import { queryClient } from './lib/query-client';
import { AppStatus } from './pwa/AppStatus';
import './pwa/install';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <AppStatus />
    </QueryClientProvider>
  </StrictMode>,
);
