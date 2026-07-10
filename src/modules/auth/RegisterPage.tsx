import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/shared/components/Button'
import { FormError } from '@/shared/components/FormError'
import { TextField } from '@/shared/components/FormControls'
import { getApiErrorMessage } from '@/shared/api/httpClient'
import { clearClinicalWorkspace } from '@/shared/utils/clinicalWorkspace'
import { useAuth } from './useAuth'

const registerSchema = z
  .object({
    username: z.string().email('Correo invalido'),
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Minimo 8 caracteres'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Los passwords no coinciden',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      confirmPassword: '',
      password: '',
      username: '',
    },
  })

  async function onSubmit(values: RegisterForm) {
    setError(null)
    try {
      await signUp({
        password: values.password,
        roles: ['ROLE_USER'],
        username: values.username,
      })
      await signIn({
        password: values.password,
        username: values.username,
      })
      clearClinicalWorkspace()
      navigate('/onboarding/doctor', { replace: true })
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Registro médico</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Crear cuenta</h2>
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
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          label="Password"
          type="password"
          {...form.register('password')}
        />
        <TextField
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword?.message}
          label="Confirmar password"
          type="password"
          {...form.register('confirmPassword')}
        />
        <Button className="w-full" isLoading={form.formState.isSubmitting} type="submit">
          Registrar
        </Button>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600">
        <Link className="text-blue-600 hover:text-blue-700" to="/login">
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  )
}
