import axios from 'axios'
import { env } from '@/config/env'
import { clearStoredAuth, getStoredAuth } from '@/modules/auth/authStorage'
import type { ApiErrorResponse } from '@/shared/types/api'

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use((config) => {
  const auth = getStoredAuth()
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }

  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearStoredAuth()
      window.dispatchEvent(new Event('medibridge:session-expired'))
    }

    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const payload = error.response?.data
    return payload?.message || payload?.error || error.message
  }

  if (error instanceof Error) return error.message
  return 'No se pudo completar la operacion'
}
