import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/shared/i18n';
import { ToastProvider } from '@/shared/components/ui/Toast';
import { ConfirmProvider } from '@/shared/components/ui/ConfirmDialog';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
