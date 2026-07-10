import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/shared/components/Button'
import { FormError } from '@/shared/components/FormError'
import { TextField } from '@/shared/components/FormControls'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { useAuth } from './useAuth'

const loginSchema = z.object({
  username: z.string().email('Correo invalido'),
  password: z.string().min(1, 'Password requerido'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      password: '',
      username: '',
    },
  })

  async function onSubmit(values: LoginForm) {
    setError(null)
    try {
      await signIn(values)
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from || '/dashboard', { replace: true })
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Acceso médico</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Iniciar sesion</h2>
      </div>

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormError message={error} />
        <TextField
          autoComplete="email"
          error={form.formState.errors.username?.message}
          label="Correo"
          type="email"
          {...form.register('username')}
        />
        <TextField
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          label="Password"
          type="password"
          {...form.register('password')}
        />
        <Button className="w-full" isLoading={form.formState.isSubmitting} type="submit">
          Entrar
        </Button>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600">
        <Link className="text-blue-600 hover:text-blue-700" to="/register">
          Crear cuenta medica
        </Link>
      </div>
    </div>
  )
}
