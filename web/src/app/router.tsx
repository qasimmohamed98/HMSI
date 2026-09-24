import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/layout/Logo';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const PatientsPage = lazy(() => import('@/pages/PatientsPage'));
const PatientChartPage = lazy(() => import('@/pages/PatientChartPage'));
const WardsPage = lazy(() => import('@/pages/WardsPage'));
const DepartmentsPage = lazy(() => import('@/pages/DepartmentsPage'));
const LaboratoryPage = lazy(() => import('@/pages/LaboratoryPage'));
const RadiologyPage = lazy(() => import('@/pages/RadiologyPage'));
const PharmacyPage = lazy(() => import('@/pages/PharmacyPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const TrackPage = lazy(() => import('@/pages/TrackPage'));
const HospitalsPage = lazy(() => import('@/pages/HospitalsPage'));

function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
        <Logo compact />
      </div>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'guest') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'authed') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    // صفحة عامة لذوي المريض (بدون تسجيل دخول)
    path: '/track/:code',
    element: withSuspense(<TrackPage />),
  },
  {
    path: '/',
    element: (
      <Protected>
        <AppShell />
      </Protected>
    ),
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'patients', element: withSuspense(<PatientsPage />) },
      { path: 'patients/:id', element: withSuspense(<PatientChartPage />) },
      { path: 'wards', element: withSuspense(<WardsPage />) },
      { path: 'departments', element: withSuspense(<DepartmentsPage />) },
      { path: 'laboratory', element: withSuspense(<LaboratoryPage />) },
      { path: 'radiology', element: withSuspense(<RadiologyPage />) },
      { path: 'pharmacy', element: withSuspense(<PharmacyPage />) },
      { path: 'reports', element: withSuspense(<ReportsPage />) },
      { path: 'users', element: withSuspense(<UsersPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
      { path: 'hospitals', element: withSuspense(<HospitalsPage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
]);