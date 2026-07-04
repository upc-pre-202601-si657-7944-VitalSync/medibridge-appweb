import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '@/shared/api/medibridgeApi'
import type { AuthenticatedUser } from '@/shared/types/api'
import { clearClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'
import { AuthContext, type AuthContextValue } from './authContextValue'
import { clearStoredAuth, getStoredAuth, setStoredAuth } from './authStorage'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => getStoredAuth())

  useEffect(() => {
    function expireSession() {
      setUser(null)
    }

    window.addEventListener('medibridge:session-expired', expireSession)
    return () => window.removeEventListener('medibridge:session-expired', expireSession)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user?.token),
      async signIn(payload) {
        const authenticatedUser = await authApi.signIn(payload)
        setStoredAuth(authenticatedUser)
        setUser(authenticatedUser)
        return authenticatedUser
      },
      async signUp(payload) {
        return authApi.signUp(payload)
      },
      signOut() {
        clearStoredAuth()
        clearClinicalWorkspace()
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
