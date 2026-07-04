import type { AuthenticatedUser } from '@/shared/types/api'

const authKey = 'medibridge.auth'

export function getStoredAuth() {
  const rawValue = localStorage.getItem(authKey)
  if (!rawValue) return null

  try {
    return JSON.parse(rawValue) as AuthenticatedUser
  } catch {
    localStorage.removeItem(authKey)
    return null
  }
}

export function setStoredAuth(user: AuthenticatedUser) {
  localStorage.setItem(authKey, JSON.stringify(user))
}

export function clearStoredAuth() {
  localStorage.removeItem(authKey)
}
