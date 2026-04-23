import { type FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, AtSign, LockKeyhole, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, type ApiError, type AuthUser } from '@/lib/api'

type LoginScreenProps = {
  onLogin: (user: AuthUser) => void
}

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo iniciar sesion.'
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
      <div className="grid min-h-svh px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)] lg:items-stretch">
          <section className="overflow-hidden rounded-[2rem] border border-[var(--ui-border)] bg-[var(--ui-card)] p-6 shadow-[var(--ui-shadow-card)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6">
              <div className="grid size-20 place-items-center rounded-[1.5rem] border border-pink-200/70 bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 text-3xl font-black text-rose-700 shadow-[var(--ui-shadow-soft)] dark:border-pink-300/10 dark:from-pink-500/20 dark:via-rose-500/16 dark:to-orange-400/14 dark:text-pink-100">
                GL
              </div>

              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-pink-200/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:border-pink-300/10 dark:bg-white/5 dark:text-pink-200">
                  ERP interno
                </div>
                <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.04em] min-[380px]:text-4xl sm:text-5xl">
                  Gummy Lover&apos;s
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Inventario por lotes, cobranza B2B y control financiero de socios en una sola operacion.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: 'Inventario',
                    copy: 'Entradas por lote, stock remanente y conversion a porciones.',
                  },
                  {
                    title: 'Cobranza',
                    copy: 'Clientes con saldo, pagos parciales y cartera visible.',
                  },
                  {
                    title: 'Smart Split',
                    copy: 'Reembolsos pendientes y utilidad neta lista para repartir.',
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border bg-background/55 p-4 shadow-[var(--ui-shadow-soft)]">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Card className="overflow-hidden rounded-[2rem] border-[var(--ui-border)] bg-card/92 shadow-[var(--ui-shadow-card)] backdrop-blur-xl">
            <CardContent className="flex h-full flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl border bg-pink-50 text-rose-700 dark:bg-pink-400/10 dark:text-pink-200">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">Acceso</h2>
                    <p className="text-sm text-muted-foreground">Solo Efrain Leyva y Erika Mora.</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border bg-background/55 p-4">
                    <p className="text-sm font-medium">Sesion privada</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      El modo claro u oscuro solo se cambia una vez dentro del sistema.
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-background/55 p-4">
                    <p className="text-sm font-medium">Uso movil y escritorio</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Registro rapido para campo y control completo desde escritorio.
                    </p>
                  </div>
                </div>
              </div>

              <Button className="mt-6 gap-2" onClick={() => setShowLogin(true)}>
                Iniciar
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-svh place-items-center px-4 py-6">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-center">
        <section className="hidden overflow-hidden rounded-[2rem] border border-[var(--ui-border)] bg-[var(--ui-card)] p-8 shadow-[var(--ui-shadow-card)] backdrop-blur-xl lg:block">
          <div className="space-y-5">
            <div className="grid size-20 place-items-center rounded-[1.5rem] border border-pink-200/70 bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 text-3xl font-black text-rose-700 shadow-[var(--ui-shadow-soft)] dark:border-pink-300/10 dark:from-pink-500/20 dark:via-rose-500/16 dark:to-orange-400/14 dark:text-pink-100">
              GL
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.04em]">Gummy Lover&apos;s ERP</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Acceso interno para inventario, cobranza y control financiero del negocio.
              </p>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden rounded-[2rem] border-[var(--ui-border)] bg-card/92 shadow-[var(--ui-shadow-card)] backdrop-blur-xl">
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
              <div className="grid size-12 place-items-center rounded-2xl border bg-pink-50 text-rose-700 dark:bg-pink-400/10 dark:text-pink-200">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Iniciar sesion</h2>
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
                <Label htmlFor="password">Contrasena</Label>
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
