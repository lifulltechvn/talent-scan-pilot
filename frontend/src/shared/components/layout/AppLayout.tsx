import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { LoadingPage } from '@/shared/components/ui/LoadingSkeleton';
import { UploadProgressWidget } from '@/shared/components/ui/UploadProgressWidget';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function AppLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (isLoading) return <LoadingPage />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Redirect interviewer to their dashboard if accessing HR pages
  if (user?.role === 'interviewer' && location.pathname !== '/interviewer') {
    return <Navigate to="/interviewer" replace />;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed(c => !c)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={cn('transition-all duration-200', collapsed ? 'md:ml-16' : 'md:ml-56')}>
        <Header onMenuClick={() => setMobileOpen(o => !o)} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <UploadProgressWidget />
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
