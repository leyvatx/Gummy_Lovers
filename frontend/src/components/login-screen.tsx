import { type FormEvent, useState } from 'react'
import { AtSign, LockKeyhole, ShieldCheck } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, type ApiError, type AuthUser } from '@/lib/api'

type LoginScreenProps = {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogin: (user: AuthUser) => void
}

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo iniciar sesión.'
}

function LoginScreen({ theme, onToggleTheme, onLogin }: LoginScreenProps) {
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

  return (
    <div className="grid min-h-svh place-items-center px-4 py-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,440px)] lg:items-center">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--ui-border)] bg-[var(--ui-card)] p-6 shadow-[var(--ui-shadow-card)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="grid size-24 shrink-0 place-items-center rounded-[1.75rem] border border-pink-200/70 bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 text-3xl font-black text-rose-700 shadow-[var(--ui-shadow-soft)] dark:border-pink-300/10 dark:from-pink-500/20 dark:via-rose-500/16 dark:to-orange-400/14 dark:text-pink-100">
              GL
            </div>
            <div>
              <div className="inline-flex rounded-full border border-pink-200/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:border-pink-300/10 dark:bg-white/5 dark:text-pink-200">
                Acceso privado
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal min-[380px]:text-4xl sm:text-5xl">
                Gummy Lover's ERP
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Gestión interna para inventario B2B, cobranza y reparto financiero de los dos socios fundadores.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Inventario por lotes', 'Smart Split 50/50', 'Cobranza B2B'].map((item) => (
              <div key={item} className="rounded-2xl border bg-background/55 px-4 py-3 text-sm font-medium shadow-[var(--ui-shadow-soft)]">
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="overflow-hidden rounded-[2rem] border-[var(--ui-border)] bg-card/92 shadow-[var(--ui-shadow-card)] backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl border bg-pink-50 text-rose-700 dark:bg-pink-400/10 dark:text-pink-200">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
                <p className="text-sm text-muted-foreground">Solo Efrain Leyva y Erika Mora.</p>
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
    </div>
  )
}

export { LoginScreen }
