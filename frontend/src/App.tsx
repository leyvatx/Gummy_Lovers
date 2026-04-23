import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, HandCoins, Menu, PackageCheck, RefreshCw, Scale, WalletCards } from 'lucide-react'

import { AdminProfilesCard } from '@/components/dashboard/admin-profiles-card'
import { CustomerTable } from '@/components/dashboard/customer-table'
import { MetricCard } from '@/components/dashboard/metric-card'
import { AppSidebar, type AppSection } from '@/components/layout/app-sidebar'
import { CatalogWorkspace } from '@/components/management/catalog-workspace'
import { DirectSaleAction } from '@/components/forms/direct-sale-action'
import { ExpenseAction } from '@/components/forms/expense-action'
import { PaymentAction } from '@/components/forms/payment-action'
import { LoginScreen } from '@/components/login-screen'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { UserMenu } from '@/components/user-menu'
import {
  getAdminProfiles,
  getCurrentUser,
  getCustomerPrices,
  getCustomers,
  getFinancialSnapshot,
  getInventoryLots,
  getProducts,
  getSuppliers,
  hasStoredAuthToken,
  logout as apiLogout,
  type ApiError,
  type AuthUser,
  type Customer,
  type CustomerPrice,
  type FinancialSnapshot,
  type InventoryLot,
  type Product,
  type Supplier,
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

const sectionMeta: Record<AppSection, { badge: string; title: string; description: string }> = {
  dashboard: {
    badge: 'Operacion B2B',
    title: 'Dashboard financiero',
    description: 'Inventario, cobranza y reparto de socios en una vista operativa.',
  },
  suppliers: {
    badge: 'Tabla base',
    title: 'Proveedores',
    description: 'Alta y consulta de proveedores para compras e inventario.',
  },
  products: {
    badge: 'Tabla base',
    title: 'Productos',
    description: 'Catalogo maestro con SKU, gramos por pieza y stock disponible.',
  },
  portions: {
    badge: 'Tabla base',
    title: 'Porciones',
    description: 'Tamano operativo por producto para ventas y conversion de inventario.',
  },
  customers: {
    badge: 'Tabla base',
    title: 'Clientes',
    description: 'Clientes mayoristas con contacto, credito y saldo.',
  },
  prices: {
    badge: 'Tabla base',
    title: 'Precios',
    description: 'Tarifa por cliente, producto y porcion.',
  },
  lots: {
    badge: 'Tabla base',
    title: 'Lotes',
    description: 'Entradas de inventario por lote con costo y stock remanente.',
  },
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
  const [currentSection, setCurrentSection] = useState<AppSection>('dashboard')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(hasStoredAuthToken)
  const [snapshot, setSnapshot] = useState<FinancialSnapshot>(emptySnapshot)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerPrices, setCustomerPrices] = useState<CustomerPrice[]>([])
  const [inventoryLots, setInventoryLots] = useState<InventoryLot[]>([])
  const [adminProfiles, setAdminProfiles] = useState<AuthUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const isRefreshingRef = useRef(false)

  const clearAuthState = useCallback(() => {
    setUser(null)
    setSnapshot(emptySnapshot)
    setCustomers([])
    setSuppliers([])
    setProducts([])
    setCustomerPrices([])
    setInventoryLots([])
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

  const fetchWorkspaceData = useCallback(async () => {
    const [financialData, customerData, supplierData, productData, customerPriceData, inventoryLotData, adminData] =
      await Promise.all([
        getFinancialSnapshot(),
        getCustomers(),
        getSuppliers(),
        getProducts(),
        getCustomerPrices(),
        getInventoryLots(),
        getAdminProfiles(),
      ])

    return {
      adminData,
      customerData,
      customerPriceData,
      financialData,
      inventoryLotData,
      productData,
      supplierData,
    }
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
        const {
          adminData,
          customerData,
          customerPriceData,
          financialData,
          inventoryLotData,
          productData,
          supplierData,
        } = await fetchWorkspaceData()

        setSnapshot(financialData)
        setCustomers(customerData)
        setSuppliers(supplierData)
        setProducts(productData)
        setCustomerPrices(customerPriceData)
        setInventoryLots(inventoryLotData)
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
    [clearAuthState, fetchWorkspaceData, user],
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
          Cargando sesion...
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen theme={theme} onToggleTheme={toggleTheme} onLogin={handleLogin} />
  }

  const currentMeta = sectionMeta[currentSection]

  function handleSectionSelect(section: AppSection) {
    setCurrentSection(section)
    setMobileSidebarOpen(false)
  }

  return (
    <div className="min-h-svh bg-background pb-28 sm:pb-0">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 2xl:px-8">
        <div className="grid w-full gap-3 rounded-[1.75rem] border border-[var(--ui-border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--ui-card)_96%,transparent),color-mix(in_srgb,var(--ui-highlight)_6%,var(--ui-card)))] px-3 py-3 shadow-[var(--ui-shadow-soft)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Abrir menu lateral</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] max-w-[88vw] border-r px-3 py-4">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu lateral</SheetTitle>
                  <SheetDescription>Acceso a dashboard y tablas base.</SheetDescription>
                </SheetHeader>
                <AppSidebar currentSection={currentSection} onSelect={handleSectionSelect} />
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-normal sm:text-xl">Gummy Lover&apos;s ERP</h1>
              <p className="truncate text-xs text-muted-foreground">{currentMeta.title}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
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
        </div>
      </header>

      <main className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6 2xl:px-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[5.5rem]">
            <AppSidebar currentSection={currentSection} onSelect={handleSectionSelect} />
          </div>
        </aside>

        <div className="grid gap-5">
          <section>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{currentMeta.badge}</Badge>
              {lastUpdated ? <span className="text-xs text-muted-foreground">Actualizado {lastUpdated}</span> : null}
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">{currentMeta.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{currentMeta.description}</p>
          </section>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {currentSection === 'dashboard' ? (
            <>
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
            </>
          ) : (
            <CatalogWorkspace
              section={currentSection}
              user={user}
              customers={customers}
              customerPrices={customerPrices}
              inventoryLots={inventoryLots}
              products={products}
              suppliers={suppliers}
              onRefresh={refreshData}
            />
          )}
        </div>
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
