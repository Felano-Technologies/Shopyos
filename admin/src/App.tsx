import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { queryClient } from './lib/query/client';
import { AppRoutes } from './routes/AppRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/common/Toast';

const DESKTOP_MIN_WIDTH = 1024;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_MIN_WIDTH);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isDesktop;
}

function DesktopOnlyNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-8 text-center">
      <div className="max-w-sm flex flex-col items-center">
        <img src="/adaptive-icon.png" alt="Shopyos" className="w-16 h-16 object-contain rounded-2xl shadow-sm mb-6" />
        <h1 className="text-xl font-bold text-navy mb-2">Desktop required</h1>
        <p className="text-subtle text-sm leading-relaxed">
          The Shopyos Admin Portal is only available on desktop and laptop screens.
          Please switch to a larger screen to continue.
        </p>
      </div>
    </div>
  );
}

function App() {
  const isDesktop = useIsDesktop();

  return (
    <HelmetProvider>
      <ErrorBoundary>
        {isDesktop ? (
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AppRoutes />
              <Toast />
            </BrowserRouter>
          </QueryClientProvider>
        ) : (
          <DesktopOnlyNotice />
        )}
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
