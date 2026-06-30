import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { queryClient } from './lib/query/client';
import { AppRoutes } from './routes/AppRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/common/Toast';

function App() {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRoutes />
            <Toast />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
