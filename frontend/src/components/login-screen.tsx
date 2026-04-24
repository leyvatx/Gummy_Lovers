import { type FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, AtSign, Candy, LockKeyhole, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, type ApiError, type AuthUser } from '@/lib/api'

type LoginScreenProps = {
  onLogin: (user: AuthUser) => void
}

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo iniciar sesión.'
}

function LoginScreen({ onLogin }: LoginScreenProps) {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('efrain@gummylovers.local')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await login({ email, password })
      onLogin(user)
    } catch (loginError) {
      setError(errorMessage(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!showLogin) {
    return (
      <div className="grid min-h-svh place-items-center px-4 py-6 sm:px-6 lg:px-8">
        <main className="grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-stretch">
          <section className="relative overflow-hidden rounded-[2rem] border border-[var(--ui-border)] bg-[var(--ui-card)] p-6 shadow-[var(--ui-shadow-card)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="absolute right-[-4rem] top-[-4rem] size-56 rounded-full bg-pink-300/20 blur-3xl" />
            <div className="relative flex min-h-[360px] flex-col justify-between gap-8">
              <div className="grid size-20 place-items-center rounded-[1.5rem] border border-pink-200/70 bg-gradient-to-br from-pink-100 via-fuchsia-100 to-rose-100 text-pink-700 shadow-[var(--ui-shadow-soft)] dark:border-pink-300/10 dark:from-pink-500/20 dark:via-fuchsia-500/16 dark:to-rose-400/14 dark:text-pink-100">
                <Candy className="size-9" />
              </div>

              <div>
                <p className="mb-3 inline-flex rounded-full border border-pink-200/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pink-700 dark:border-pink-300/10 dark:bg-white/5 dark:text-pink-200">
                  Control interno
                </p>
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
                  Gummy Lover&apos;s
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  Control simple de gomitas, ventas, gastos y saldos de socios.
                </p>
              </div>
            </div>
          </section>

          <Card className="overflow-hidden rounded-[2rem] border-[var(--ui-border)] bg-card/92 shadow-[var(--ui-shadow-card)] backdrop-blur-xl">
            <CardContent className="flex h-full flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl border bg-pink-50 text-pink-700 dark:bg-pink-400/10 dark:text-pink-200">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">Acceso privado</h2>
                    <p className="text-sm text-muted-foreground">Efraín Leyva y Erika Mora.</p>
                  </div>
                </div>
              </div>

              <Button className="mt-6 gap-2" onClick={() => setShowLogin(true)}>
                Iniciar
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="grid min-h-svh place-items-center px-4 py-6">
      <Card className="w-full max-w-[440px] overflow-hidden rounded-[2rem] border-[var(--ui-border)] bg-card/92 shadow-[var(--ui-shadow-card)] backdrop-blur-xl">
        <CardContent className="p-6 sm:p-8">
          <Button
            variant="ghost"
            className="mb-4 -ml-2 gap-2 px-2 text-muted-foreground"
            onClick={() => setShowLogin(false)}
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>

          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl border bg-pink-50 text-pink-700 dark:bg-pink-400/10 dark:text-pink-200">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
              <p className="text-sm text-muted-foreground">Acceso del negocio.</p>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export { LoginScreen }
