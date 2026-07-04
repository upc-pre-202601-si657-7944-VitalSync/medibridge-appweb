import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { getClinicalWorkspace, hasCompleteDoctorProfile } from '@/shared/utils/clinicalWorkspace'

export function ProtectedRoute() {
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  const workspace = getClinicalWorkspace(user?.id)
  const isOnboarding = location.pathname === '/onboarding/doctor'

  if (!isOnboarding && !hasCompleteDoctorProfile(workspace, user?.id)) {
    return <Navigate replace state={{ from: location }} to="/onboarding/doctor" />
  }

  return <Outlet />
}

export function PublicRoute() {
  const { isAuthenticated, user } = useAuth()

  if (isAuthenticated) {
    const workspace = getClinicalWorkspace(user?.id)
    return (
      <Navigate
        replace
        to={hasCompleteDoctorProfile(workspace, user?.id) ? '/dashboard' : '/onboarding/doctor'}
      />
    )
  }

  return <Outlet />
}
