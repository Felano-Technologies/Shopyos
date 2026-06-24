
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query/client';
import { AppRoutes } from './routes/AppRoutes';
import { Toast } from './components/common/Toast';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toast />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
