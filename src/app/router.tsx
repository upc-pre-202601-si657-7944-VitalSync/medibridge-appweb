import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from '@/app/ProtectedRoute'
import { LoginPage } from '@/modules/auth/LoginPage'
import { RegisterPage } from '@/modules/auth/RegisterPage'
import { OnboardingDoctorPage } from '@/modules/auth/OnboardingDoctorPage'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { PatientsPage } from '@/modules/patients/PatientsPage'
import { NewPatientPage } from '@/modules/patients/NewPatientPage'
import { PatientOverviewPage } from '@/modules/patients/PatientOverviewPage'
import { CareTeamPage } from '@/modules/patients/CareTeamPage'
import { AppointmentsPage } from '@/modules/appointments/AppointmentsPage'
import { MedicationPage } from '@/modules/medication/MedicationPage'
import { HealthPage } from '@/modules/health/HealthPage'
import { ReportsPage } from '@/modules/reports/ReportsPage'
import { AnalyticsPage } from '@/modules/reports/AnalyticsPage'
import { SubscriptionsPage } from '@/modules/subscriptions/SubscriptionsPage'
import { ChatPage } from '@/modules/communication/ChatPage'
import { NotificationsPage } from '@/modules/communication/NotificationsPage'
import { AuthLayout } from '@/shared/layout/AuthLayout'
import { AppLayout } from '@/shared/layout/AppLayout'

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { element: <LoginPage />, path: '/login' },
          { element: <RegisterPage />, path: '/register' },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { element: <Navigate replace to="/dashboard" />, path: '/' },
          { element: <DashboardPage />, path: '/dashboard' },
          { element: <OnboardingDoctorPage />, path: '/onboarding/doctor' },
          { element: <PatientsPage />, path: '/patients' },
          { element: <NewPatientPage />, path: '/patients/new' },
          { element: <PatientOverviewPage />, path: '/patients/:patientId' },
          { element: <CareTeamPage />, path: '/patients/:patientId/care-team' },
          { element: <AppointmentsPage />, path: '/patients/:patientId/appointments' },
          { element: <MedicationPage />, path: '/patients/:patientId/medications' },
          { element: <HealthPage />, path: '/patients/:patientId/health' },
          { element: <ReportsPage />, path: '/patients/:patientId/reports' },
          { element: <AnalyticsPage />, path: '/patients/:patientId/analytics' },
          { element: <SubscriptionsPage />, path: '/subscriptions' },
          { element: <ChatPage />, path: '/chat' },
          { element: <NotificationsPage />, path: '/notifications' },
        ],
      },
    ],
  },
])
