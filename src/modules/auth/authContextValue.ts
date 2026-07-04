import { createContext } from 'react'
import type { AuthenticatedUser, SignInRequest, SignUpRequest, UserResource } from '@/shared/types/api'

export type AuthContextValue = {
  user: AuthenticatedUser | null
  isAuthenticated: boolean
  signIn: (payload: SignInRequest) => Promise<AuthenticatedUser>
  signUp: (payload: SignUpRequest) => Promise<UserResource>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
