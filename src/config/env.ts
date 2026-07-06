const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is required')
}

export const env = {
  apiBaseUrl,
  enablePaymentMocks: import.meta.env.VITE_ENABLE_PAYMENT_MOCKS === 'true',
} as const
