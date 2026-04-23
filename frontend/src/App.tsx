import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, HandCoins, PackageCheck, RefreshCw, Scale, WalletCards } from 'lucide-react'

import { CustomerTable } from '@/components/dashboard/customer-table'
import { AdminProfilesCard } from '@/components/dashboard/admin-profiles-card'
import { MetricCard } from '@/components/dashboard/metric-card'
import { DirectSaleAction } from '@/components/forms/direct-sale-action'
import { ExpenseAction } from '@/components/forms/expense-action'
import { PaymentAction } from '@/components/forms/payment-action'
import { LoginScreen } from '@/components/login-screen'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserMenu } from '@/components/user-menu'
import {
  getCurrentUser,
  getAdminProfiles,
  getCustomerBalances,
  getFinancialSnapshot,
  getProducts,
  hasStoredAuthToken,
  logout as apiLogout,
  type ApiError,
  type AuthUser,
  type CustomerBalance,
  type FinancialSnapshot,
  type Product,
} from '@/lib/api'
import { formatMoney } from '@/lib/format'

const DASHBOARD_REFRESH_MS = 15_000
const SESSION_KEEPALIVE_MS = 5 * 60_000

const emptySnapshot: FinancialSnapshot = {
  cash_on_hand: '0.00',
  accounts_receivable: '0.00',
  pending_expense_reimbursements: '0.00',
  partner_reimbursements_available: '0.00',
  inventory_reserve_allocated: '0.00',
  net_profit_available: '0.00',
  partners: [],
}

function getInitialTheme(): 'light' | 'dark' {
  const storedTheme = localStorage.getItem('gummy-theme')
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function isAuthError(error: unknown) {
  const status = (error as ApiError)?.status
  return status === 401 || status === 403
}

function sameUser(currentUser: AuthUser, nextUser: AuthUser) {
  return (
    currentUser.id === nextUser.id &&
    currentUser.email === nextUser.email &&
    currentUser.full_name === nextUser.full_name &&
    currentUser.is_staff === nextUser.is_staff &&
    currentUser.is_superuser === nextUser.is_superuser
  )
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(hasStoredAuthToken)
  const [snapshot, setSnapshot] = useState<FinancialSnapshot>(emptySnapshot)
  const [customers, setCustomers] = useState<CustomerBalance[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [adminProfiles, setAdminProfiles] = useState<AuthUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const isRefreshingRef = useRef(false)

  const clearAuthState = useCallback(() => {
    setUser(null)
    setSnapshot(emptySnapshot)
    setCustomers([])
    setProducts([])
    setAdminProfiles([])
    setIsLoading(false)
    setError('')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('gummy-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!hasStoredAuthToken()) {
      return
    }

    let isMounted = true

    getCurrentUser()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (isMounted) {
          clearAuthState()
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [clearAuthState])

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }, [])

  const fetchDashboardData = useCallback(async () => {
    const [financialData, customerData, productData, adminData] = await Promise.all([
      getFinancialSnapshot(),
      getCustomerBalances(),
      getProducts(),
      getAdminProfiles(),
    ])

    return { financialData, customerData, productData, adminData }
  }, [])

  const refreshData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user) {
        return
      }

      if (isRefreshingRef.current) {
        return
      }

      isRefreshingRef.current = true

      if (!silent) {
        setIsLoading(true)
        setError('')
      }

      try {
        const { financialData, customerData, productData, adminData } = await fetchDashboardData()

        setSnapshot(financialData)
        setCustomers(customerData)
        setProducts(productData)
        setAdminProfiles(adminData)
        setLastUpdated(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
        setError('')
      } catch (refreshError) {
        if (isAuthError(refreshError)) {
          clearAuthState()
        } else {
          setError('No se pudo sincronizar con la API.')
        }
      } finally {
        isRefreshingRef.current = false
        if (!silent) {
          setIsLoading(false)
        }
      }
    },
    [clearAuthState, fetchDashboardData, user],
  )

  useEffect(() => {
    if (!user) {
      return
    }

    const timeoutId = window.setTimeout(() => void refreshData(), 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [refreshData, user])

  useEffect(() => {
    if (!user) {
      return
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        void refreshData({ silent: true })
      }
    }

    const intervalId = window.setInterval(refreshWhenVisible, DASHBOARD_REFRESH_MS)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshData, user])

  useEffect(() => {
    if (!user) {
      return
    }

    async function keepSessionAlive() {
      try {
        const currentUser = await getCurrentUser()
        setUser((existingUser) => {
          if (!existingUser || sameUser(existingUser, currentUser)) {
            return existingUser
          }

          return currentUser
        })
      } catch (keepAliveError) {
        if (isAuthError(keepAliveError)) {
          clearAuthState()
        }
      }
    }

    const intervalId = window.setInterval(() => void keepSessionAlive(), SESSION_KEEPALIVE_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [clearAuthState, user])

  const handleLogin = useCallback((loggedUser: AuthUser) => {
    setUser(loggedUser)
    setIsLoading(true)
    setError('')
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      clearAuthState()
    }
  }, [clearAuthState])

  const metrics = useMemo(
    () => [
      {
        title: 'Deuda a socios',
        value: formatMoney(snapshot.partner_reimbursements_available),
        helper: 'Reembolsos listos para pagar',
        icon: HandCoins,
        tone: 'rose' as const,
      },
      {
        title: 'Ganancia neta',
        value: formatMoney(snapshot.net_profit_available),
        helper: 'Utilidad disponible 50/50',
        icon: Scale,
        tone: 'emerald' as const,
      },
      {
        title: 'Cuentas por cobrar',
        value: formatMoney(snapshot.accounts_receivable),
        helper: 'Saldo abierto de clientes mayoristas',
        icon: WalletCards,
        tone: 'amber' as const,
      },
      {
        title: 'Caja',
        value: formatMoney(snapshot.cash_on_hand),
        helper: 'Entradas menos retiros',
        icon: Banknote,
        tone: 'cyan' as const,
      },
    ],
    [snapshot],
  )

  if (isAuthLoading) {
    return (
      <div className="grid min-h-svh place-items-center">
        <div className="rounded-3xl border bg-card/90 px-5 py-4 text-sm text-muted-foreground shadow-[var(--ui-shadow-soft)]">
          Cargando sesión...
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen theme={theme} onToggleTheme={toggleTheme} onLogin={handleLogin} />
  }

  return (
    <div className="min-h-svh pb-24 sm:pb-0">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 2xl:px-8">
        <div className="grid w-full gap-3 rounded-[1.75rem] border border-[var(--ui-border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--ui-card)_96%,transparent),color-mix(in_srgb,var(--ui-highlight)_6%,var(--ui-card)))] px-3 py-3 shadow-[var(--ui-shadow-soft)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-400 via-rose-500 to-orange-400 text-sm font-black text-white shadow-[var(--ui-shadow-soft)]">
              GL
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-normal sm:text-xl">Dashboard financiero</h1>
              <p className="truncate text-xs text-muted-foreground">Gummy Lover's ERP</p>
            </div>
          </div>

          <div className="hidden min-w-0 flex-wrap items-center justify-end gap-2 sm:flex">
            <DirectSaleAction user={user} products={products} onCreated={refreshData} />
            <ExpenseAction user={user} onCreated={refreshData} />
            <PaymentAction customers={customers} onCreated={refreshData} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Button variant="ghost" size="icon" onClick={() => void refreshData()} disabled={isLoading}>
              <RefreshCw className={isLoading ? 'animate-spin' : ''} />
              <span className="sr-only">Actualizar</span>
            </Button>
            <UserMenu user={user} onLogout={() => void handleLogout()} />
          </div>

          <div className="flex items-center justify-end gap-2 sm:hidden">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Button variant="ghost" size="icon" onClick={() => void refreshData()} disabled={isLoading}>
              <RefreshCw className={isLoading ? 'animate-spin' : ''} />
              <span className="sr-only">Actualizar</span>
            </Button>
            <UserMenu user={user} onLogout={() => void handleLogout()} />
          </div>
        </div>
      </header>

      <main className="grid w-full gap-5 px-4 py-5 sm:px-6 sm:py-6 2xl:px-8">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Operación B2B</Badge>
              {lastUpdated ? <span className="text-xs text-muted-foreground">Actualizado {lastUpdated}</span> : null}
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard financiero</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Inventario, cobranza y reparto de socios en una vista operativa.
            </p>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_480px]">
          <CustomerTable customers={customers} />

          <aside className="grid content-start gap-5">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Socios</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4 sm:pt-5">
                {snapshot.partners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin socios activos registrados.</p>
                ) : (
                  snapshot.partners.map((partner) => (
                    <div key={partner.partner_id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{partner.name}</p>
                          <p className="text-xs text-muted-foreground">Socio {partner.code}</p>
                        </div>
                        <Badge variant="secondary">{formatMoney(partner.net_partner_balance)}</Badge>
                      </div>
                      <dl className="mt-4 grid gap-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Reembolso disponible</dt>
                          <dd className="font-medium tabular-nums">
                            {formatMoney(partner.reimbursements_available_to_payout)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Utilidad disponible</dt>
                          <dd className="font-medium tabular-nums">
                            {formatMoney(partner.profit_available_to_payout)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Gastos pendientes</dt>
                          <dd className="font-medium tabular-nums">
                            {formatMoney(partner.reimbursements_pending_to_allocate)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))
                )}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                  <div className="flex items-center gap-2 font-medium">
                    <PackageCheck className="size-4" />
                    Reserva de inventario
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatMoney(snapshot.inventory_reserve_allocated)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <AdminProfilesCard admins={adminProfiles} />
          </aside>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-3 shadow-lg sm:hidden">
        <div className="grid w-full grid-cols-3 gap-2">
          <DirectSaleAction user={user} products={products} onCreated={refreshData} />
          <ExpenseAction user={user} onCreated={refreshData} />
          <PaymentAction customers={customers} onCreated={refreshData} />
        </div>
      </div>
    </div>
  )
}

export default App
