import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { LoadingPage, LoadingSpinner } from '@/shared/components/ui/LoadingSkeleton';
import { AuthProvider } from '@/features/auth/hooks/useAuth';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';

const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CandidatesPage = lazy(() => import('@/features/candidates/pages/CandidatesPage').then(m => ({ default: m.CandidatesPage })));
const CandidateDetailPage = lazy(() => import('@/features/candidates/pages/CandidateDetailPage').then(m => ({ default: m.CandidateDetailPage })));
const JobsPage = lazy(() => import('@/features/jobs/pages/JobsPage').then(m => ({ default: m.JobsPage })));
const JobDetailPage = lazy(() => import('@/features/jobs/pages/JobDetailPage').then(m => ({ default: m.JobDetailPage })));
const InterviewsPage = lazy(() => import('@/features/interviews/pages/InterviewsPage').then(m => ({ default: m.InterviewsPage })));
const TalentPoolPage = lazy(() => import('@/features/talent-pool/pages/TalentPoolPage').then(m => ({ default: m.TalentPoolPage })));

function LazyLoad({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
}

function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <AuthRoot />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <LazyLoad><DashboardPage /></LazyLoad> },
          { path: 'candidates', element: <LazyLoad><CandidatesPage /></LazyLoad> },
          { path: 'candidates/:id', element: <LazyLoad><CandidateDetailPage /></LazyLoad> },
          { path: 'jobs', element: <LazyLoad><JobsPage /></LazyLoad> },
          { path: 'jobs/:id', element: <LazyLoad><JobDetailPage /></LazyLoad> },
          { path: 'interviews', element: <LazyLoad><InterviewsPage /></LazyLoad> },
          { path: 'talent-pool', element: <LazyLoad><TalentPoolPage /></LazyLoad> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
