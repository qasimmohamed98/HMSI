import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteError } from './RouteError';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/layout/Logo';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
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
const SystemHealthPage = lazy(() => import('@/pages/SystemHealthPage'));
const MedicationRoundsPage = lazy(() => import('@/pages/MedicationRoundsPage'));
const HandoverPage = lazy(() => import('@/pages/HandoverPage'));
const AuditPage = lazy(() => import('@/pages/AuditPage'));
const TrashPage = lazy(() => import('@/pages/TrashPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const SystemPage = lazy(() => import('@/pages/SystemPage'));
const GuidePage = lazy(() => import('@/pages/GuidePage'));

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

// أي خطأ عرض غير متوقع في أي صفحة يظهر كرسالة واضحة ويُبلَّغ لسجل الأخطاء
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        path: '/login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      // صفحات عامة للزوار والمستخدمين
      { path: '/about', element: withSuspense(<AboutPage />) },
      { path: '/system', element: withSuspense(<SystemPage />) },
      { path: '/guide', element: withSuspense(<GuidePage />) },
      { path: '/privacy', element: withSuspense(<LegalPage doc="privacy" />) },
      { path: '/terms', element: withSuspense(<LegalPage doc="terms" />) },
      {
        path: '/signup',
        element: <GuestOnly>{withSuspense(<SignupPage />)}</GuestOnly>,
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
          { path: 'medication-rounds', element: withSuspense(<MedicationRoundsPage />) },
          { path: 'handover', element: withSuspense(<HandoverPage />) },
          { path: 'reports', element: withSuspense(<ReportsPage />) },
          { path: 'users', element: withSuspense(<UsersPage />) },
          { path: 'settings', element: withSuspense(<SettingsPage />) },
          { path: 'hospitals', element: withSuspense(<HospitalsPage />) },
          { path: 'system-health', element: withSuspense(<SystemHealthPage />) },
          { path: 'audit', element: withSuspense(<AuditPage />) },
          { path: 'trash', element: withSuspense(<TrashPage />) },
          { path: 'billing', element: withSuspense(<BillingPage />) },
          { path: '*', element: withSuspense(<NotFoundPage />) },
        ],
      },
    ],
  },
]);
