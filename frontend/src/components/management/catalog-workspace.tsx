import { useMemo, useState } from 'react'
import { Boxes, CircleDollarSign, Package2, Search, Tags, Truck, Users, Wallet2 } from 'lucide-react'

import type { AppSection } from '@/components/layout/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  toNumber,
  type Customer,
  type InventoryLot,
  type Product,
  type Supplier,
} from '@/lib/api'
import { formatCompactMoney, formatGrams, formatMoney } from '@/lib/format'

type CatalogWorkspaceProps = {
  section: Exclude<AppSection, 'dashboard'>
  customers: Customer[]
  inventoryLots: InventoryLot[]
  products: Product[]
  suppliers: Supplier[]
}

type MetricItem = {
  icon: typeof Truck
  label: string
  value: string
  helper: string
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function matchesQuery(query: string, values: Array<string | number | null | undefined>) {
  if (!query) {
    return true
  }

  return values
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function inventoryStatus(remainingGrams: number) {
  if (remainingGrams <= 0) {
    return {
      label: 'Agotado',
      className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100',
    }
  }

  if (remainingGrams < 2000) {
    return {
      label: 'Bajo',
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100',
    }
  }

  return {
    label: 'Disponible',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100',
  }
}

function balanceStatus(balance: number, creditLimit: number) {
  if (balance <= 0) {
    return {
      label: 'Al dia',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100',
    }
  }

  if (creditLimit > 0 && balance > creditLimit) {
    return {
      label: 'Sobre limite',
      className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100',
    }
  }

  return {
    label: 'Pendiente',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100',
  }
}

function remainingLotValue(lot: InventoryLot) {
  const totalGrams = toNumber(lot.total_grams)
  const remainingGrams = toNumber(lot.remaining_grams)
  const totalCost = toNumber(lot.total_cost)

  if (totalGrams <= 0 || remainingGrams <= 0 || totalCost <= 0) {
    return 0
  }

  return (remainingGrams / totalGrams) * totalCost
}

function SectionToolbar({
  countLabel,
  placeholder,
  query,
  onQueryChange,
}: {
  countLabel: string
  placeholder: string
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-[auto_minmax(0,320px)] lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{countLabel}</Badge>
      </div>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="pl-9"
          placeholder={placeholder}
        />
      </div>
    </section>
  )
}

function SectionMetrics({ items }: { items: MetricItem[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.label} className="rounded-2xl border bg-card/90 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 break-words text-xl font-semibold tracking-[-0.04em]">{item.value}</p>
              </div>
              <span className="grid size-10 place-items-center rounded-2xl border bg-background text-muted-foreground">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.helper}</p>
          </div>
        )
      })}
    </section>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-sm text-muted-foreground">{label}</div>
}

function MobileCards({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 p-4 md:hidden">{children}</div>
}

function MobileCard({ children }: { children: React.ReactNode }) {
  return <article className="rounded-2xl border bg-background/60 p-4 shadow-sm">{children}</article>
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function DesktopTable({ children }: { children: React.ReactNode }) {
  return <div className="hidden overflow-x-auto md:block">{children}</div>
}

function SuppliersSection({ suppliers }: Pick<CatalogWorkspaceProps, 'suppliers'>) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearch(query)
  const filteredSuppliers = useMemo(
    () => suppliers.filter((supplier) => matchesQuery(normalizedQuery, [supplier.name, supplier.phone, supplier.notes])),
    [normalizedQuery, suppliers],
  )

  const metrics: MetricItem[] = [
    { icon: Truck, label: 'Proveedores', value: suppliers.length.toString(), helper: 'Base total de compra' },
    { icon: Users, label: 'Con telefono', value: suppliers.filter((supplier) => Boolean(supplier.phone)).length.toString(), helper: 'Contactos listos para compra' },
    { icon: Package2, label: 'Con notas', value: suppliers.filter((supplier) => Boolean(supplier.notes)).length.toString(), helper: 'Proveedores con contexto operativo' },
    { icon: Search, label: 'Visibles', value: filteredSuppliers.length.toString(), helper: 'Resultado del filtro actual' },
  ]

  return (
    <div className="grid gap-5">
      <SectionMetrics items={metrics} />
      <SectionToolbar
        countLabel={`${filteredSuppliers.length} de ${suppliers.length} registro(s)`}
        placeholder="Buscar proveedor"
        query={query}
        onQueryChange={setQuery}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Proveedores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSuppliers.length === 0 ? (
            <EmptyState label="No hay proveedores para mostrar con este filtro." />
          ) : (
            <>
              <MobileCards>
                {filteredSuppliers.map((supplier) => (
                  <MobileCard key={supplier.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{supplier.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{supplier.phone || 'Sin telefono'}</p>
                      </div>
                      <Badge variant="outline" className={supplier.phone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>
                        {supplier.phone ? 'Contacto listo' : 'Sin contacto'}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <FieldRow label="Notas" value={supplier.notes || 'Sin notas'} />
                    </dl>
                  </MobileCard>
                ))}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Nombre</th>
                      <th className="px-4 py-3 font-medium">Telefono</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-t">
                        <td className="px-4 py-4 font-medium sm:px-5">{supplier.name}</td>
                        <td className="px-4 py-4 text-muted-foreground">{supplier.phone || 'Sin telefono'}</td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className={supplier.phone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>
                            {supplier.phone ? 'Contacto listo' : 'Sin contacto'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground sm:px-5">{supplier.notes || 'Sin notas'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DesktopTable>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProductsSection({ products }: Pick<CatalogWorkspaceProps, 'products'>) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearch(query)
  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        matchesQuery(normalizedQuery, [product.name, product.sku, ...product.portions.map((portion) => portion.name)]),
      ),
    [normalizedQuery, products],
  )

  const totalAvailableGrams = products.reduce((sum, product) => sum + toNumber(product.available_grams), 0)
  const lowStockCount = products.filter((product) => {
    const grams = toNumber(product.available_grams)
    return grams > 0 && grams < 2000
  }).length
  const noPortionsCount = products.filter((product) => product.portions.filter((portion) => portion.active).length === 0).length

  const metrics: MetricItem[] = [
    { icon: Package2, label: 'Productos', value: products.length.toString(), helper: 'Catalogo activo' },
    { icon: Boxes, label: 'Stock total', value: formatGrams(totalAvailableGrams), helper: 'Inventario disponible acumulado' },
    { icon: Tags, label: 'Stock bajo', value: lowStockCount.toString(), helper: 'Productos debajo de 2 kg' },
    { icon: Search, label: 'Sin porciones', value: noPortionsCount.toString(), helper: 'Productos incompletos para vender' },
  ]

  return (
    <div className="grid gap-5">
      <SectionMetrics items={metrics} />
      <SectionToolbar
        countLabel={`${filteredProducts.length} de ${products.length} producto(s)`}
        placeholder="Buscar producto o SKU"
        query={query}
        onQueryChange={setQuery}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <EmptyState label="No hay productos para mostrar con este filtro." />
          ) : (
            <>
              <MobileCards>
                {filteredProducts.map((product) => {
                  const activePortions = product.portions.filter((portion) => portion.active)
                  const status = inventoryStatus(toNumber(product.available_grams))

                  return (
                    <MobileCard key={product.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{product.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{product.sku}</p>
                        </div>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      <dl className="mt-4 grid gap-2 text-sm">
                        <FieldRow label="Gramos por pieza" value={<span className="tabular-nums">{formatGrams(product.grams_per_piece)}</span>} />
                        <FieldRow label="Disponible" value={<span className="tabular-nums font-medium">{formatGrams(product.available_grams)}</span>} />
                        <FieldRow
                          label="Porciones"
                          value={
                            activePortions.length > 0 ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                {activePortions.map((portion) => (
                                  <Badge key={portion.id} variant="secondary">
                                    {portion.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              'Sin porciones'
                            )
                          }
                        />
                      </dl>
                    </MobileCard>
                  )
                })}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Producto</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Gramos por pieza</th>
                      <th className="px-4 py-3 font-medium">Disponible</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Porciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const activePortions = product.portions.filter((portion) => portion.active)
                      const status = inventoryStatus(toNumber(product.available_grams))

                      return (
                        <tr key={product.id} className="border-t">
                          <td className="px-4 py-4 font-medium sm:px-5">{product.name}</td>
                          <td className="px-4 py-4 text-muted-foreground">{product.sku}</td>
                          <td className="px-4 py-4 text-muted-foreground tabular-nums">{formatGrams(product.grams_per_piece)}</td>
                          <td className="px-4 py-4 font-medium tabular-nums">{formatGrams(product.available_grams)}</td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 sm:px-5">
                            <div className="flex flex-wrap gap-2">
                              {activePortions.map((portion) => (
                                <Badge key={portion.id} variant="secondary">
                                  {portion.name} · {portion.pieces_per_portion} pzs
                                </Badge>
                              ))}
                              {activePortions.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Sin porciones</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </DesktopTable>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PortionsSection({ products }: Pick<CatalogWorkspaceProps, 'products'>) {
  const [query, setQuery] = useState('')

  const portions = useMemo(
    () =>
      products.flatMap((product) =>
        product.portions.map((portion) => ({
          ...portion,
          productName: product.name,
        })),
      ),
    [products],
  )

  const normalizedQuery = normalizeSearch(query)
  const filteredPortions = useMemo(
    () => portions.filter((portion) => matchesQuery(normalizedQuery, [portion.productName, portion.product_sku, portion.name])),
    [normalizedQuery, portions],
  )

  const averagePieces = portions.length > 0 ? portions.reduce((sum, portion) => sum + portion.pieces_per_portion, 0) / portions.length : 0

  const metrics: MetricItem[] = [
    { icon: Tags, label: 'Porciones', value: portions.length.toString(), helper: 'Configuraciones operativas' },
    { icon: Package2, label: 'Productos cubiertos', value: new Set(portions.map((portion) => portion.product)).size.toString(), helper: 'Productos listos para venta' },
    { icon: Boxes, label: 'Promedio', value: `${averagePieces.toLocaleString('es-MX', { maximumFractionDigits: 1 })} pzs`, helper: 'Piezas por porcion' },
    { icon: Search, label: 'Visibles', value: filteredPortions.length.toString(), helper: 'Resultado del filtro actual' },
  ]

  return (
    <div className="grid gap-5">
      <SectionMetrics items={metrics} />
      <SectionToolbar
        countLabel={`${filteredPortions.length} de ${portions.length} registro(s)`}
        placeholder="Buscar porcion o producto"
        query={query}
        onQueryChange={setQuery}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Porciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPortions.length === 0 ? (
            <EmptyState label="No hay porciones para mostrar con este filtro." />
          ) : (
            <>
              <MobileCards>
                {filteredPortions.map((portion) => (
                  <MobileCard key={portion.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{portion.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {portion.productName} · {portion.product_sku}
                        </p>
                      </div>
                      <Badge variant="outline" className={portion.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>
                        {portion.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <FieldRow label="Piezas" value={<span className="tabular-nums font-medium">{portion.pieces_per_portion}</span>} />
                    </dl>
                  </MobileCard>
                ))}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Producto</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Porcion</th>
                      <th className="px-4 py-3 font-medium">Piezas</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPortions.map((portion) => (
                      <tr key={portion.id} className="border-t">
                        <td className="px-4 py-4 font-medium sm:px-5">{portion.productName}</td>
                        <td className="px-4 py-4 text-muted-foreground">{portion.product_sku}</td>
                        <td className="px-4 py-4 text-muted-foreground">{portion.name}</td>
                        <td className="px-4 py-4 font-medium tabular-nums">{portion.pieces_per_portion}</td>
                        <td className="px-4 py-4 sm:px-5">
                          <Badge variant="outline" className={portion.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>
                            {portion.active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DesktopTable>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CustomersSection({ customers }: Pick<CatalogWorkspaceProps, 'customers'>) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearch(query)
  const filteredCustomers = useMemo(
    () => customers.filter((customer) => matchesQuery(normalizedQuery, [customer.name, customer.contact_name, customer.phone, customer.address])),
    [customers, normalizedQuery],
  )

  const totalReceivable = customers.reduce((sum, customer) => sum + toNumber(customer.outstanding_balance), 0)
  const customersWithBalance = customers.filter((customer) => toNumber(customer.outstanding_balance) > 0).length
  const overLimitCount = customers.filter((customer) => {
    const balance = toNumber(customer.outstanding_balance)
    const limit = toNumber(customer.credit_limit)
    return limit > 0 && balance > limit
  }).length

  const metrics: MetricItem[] = [
    { icon: Users, label: 'Clientes', value: customers.length.toString(), helper: 'Cartera comercial activa' },
    { icon: Wallet2, label: 'Por cobrar', value: formatCompactMoney(totalReceivable), helper: 'Saldo total abierto' },
    { icon: CircleDollarSign, label: 'Con saldo', value: customersWithBalance.toString(), helper: 'Clientes con cobranza pendiente' },
    { icon: Search, label: 'Sobre limite', value: overLimitCount.toString(), helper: 'Clientes que rebasaron credito' },
  ]

  return (
    <div className="grid gap-5">
      <SectionMetrics items={metrics} />
      <SectionToolbar
        countLabel={`${filteredCustomers.length} de ${customers.length} cliente(s)`}
        placeholder="Buscar cliente o contacto"
        query={query}
        onQueryChange={setQuery}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <EmptyState label="No hay clientes para mostrar con este filtro." />
          ) : (
            <>
              <MobileCards>
                {filteredCustomers.map((customer) => {
                  const balance = toNumber(customer.outstanding_balance)
                  const creditLimit = toNumber(customer.credit_limit)
                  const status = balanceStatus(balance, creditLimit)

                  return (
                    <MobileCard key={customer.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{customer.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{customer.contact_name || 'Sin contacto'}</p>
                        </div>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      <dl className="mt-4 grid gap-2 text-sm">
                        <FieldRow label="Telefono" value={customer.phone || 'Sin telefono'} />
                        <FieldRow label="Direccion" value={customer.address || 'Sin direccion'} />
                        <FieldRow label="Limite" value={<span className="tabular-nums">{formatMoney(customer.credit_limit)}</span>} />
                        <FieldRow label="Saldo" value={<span className="font-semibold tabular-nums">{formatMoney(customer.outstanding_balance)}</span>} />
                      </dl>
                    </MobileCard>
                  )
                })}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Cliente</th>
                      <th className="px-4 py-3 font-medium">Contacto</th>
                      <th className="px-4 py-3 font-medium">Direccion</th>
                      <th className="px-4 py-3 font-medium">Limite</th>
                      <th className="px-4 py-3 font-medium">Saldo</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => {
                      const balance = toNumber(customer.outstanding_balance)
                      const creditLimit = toNumber(customer.credit_limit)
                      const status = balanceStatus(balance, creditLimit)

                      return (
                        <tr key={customer.id} className="border-t">
                          <td className="px-4 py-4 font-medium sm:px-5">{customer.name}</td>
                          <td className="px-4 py-4 text-muted-foreground">
                            <div>{customer.contact_name || 'Sin contacto'}</div>
                            <div className="text-xs">{customer.phone || 'Sin telefono'}</div>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{customer.address || 'Sin direccion'}</td>
                          <td className="px-4 py-4 tabular-nums">{formatMoney(customer.credit_limit)}</td>
                          <td className="px-4 py-4 font-medium tabular-nums">{formatMoney(customer.outstanding_balance)}</td>
                          <td className="px-4 py-4 sm:px-5">
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </DesktopTable>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LotsSection({ inventoryLots }: Pick<CatalogWorkspaceProps, 'inventoryLots'>) {
  const [query, setQuery] = useState('')

  const sortedLots = useMemo(
    () =>
      [...inventoryLots].sort((left, right) => {
        return right.purchased_at.localeCompare(left.purchased_at) || right.lot_code.localeCompare(left.lot_code)
      }),
    [inventoryLots],
  )

  const normalizedQuery = normalizeSearch(query)
  const filteredLots = useMemo(
    () => sortedLots.filter((lot) => matchesQuery(normalizedQuery, [lot.lot_code, lot.product_sku, lot.supplier_name, lot.purchased_at])),
    [normalizedQuery, sortedLots],
  )

  const totalRemainingGrams = inventoryLots.reduce((sum, lot) => sum + toNumber(lot.remaining_grams), 0)
  const depletedLots = inventoryLots.filter((lot) => toNumber(lot.remaining_grams) <= 0).length
  const remainingValue = inventoryLots.reduce((sum, lot) => sum + remainingLotValue(lot), 0)

  const metrics: MetricItem[] = [
    { icon: Boxes, label: 'Lotes', value: inventoryLots.length.toString(), helper: 'Entradas historicas de inventario' },
    { icon: Package2, label: 'Stock remanente', value: formatGrams(totalRemainingGrams), helper: 'Inventario util disponible' },
    { icon: CircleDollarSign, label: 'Valor remanente', value: formatCompactMoney(remainingValue), helper: 'Costo estimado aun en stock' },
    { icon: Search, label: 'Agotados', value: depletedLots.toString(), helper: 'Lotes sin saldo' },
  ]

  return (
    <div className="grid gap-5">
      <SectionMetrics items={metrics} />
      <SectionToolbar
        countLabel={`${filteredLots.length} de ${inventoryLots.length} lote(s)`}
        placeholder="Buscar lote, SKU o proveedor"
        query={query}
        onQueryChange={setQuery}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Lotes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLots.length === 0 ? (
            <EmptyState label="No hay lotes para mostrar con este filtro." />
          ) : (
            <>
              <MobileCards>
                {filteredLots.map((lot) => {
                  const status = inventoryStatus(toNumber(lot.remaining_grams))
                  return (
                    <MobileCard key={lot.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{lot.lot_code}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {lot.product_sku} · {formatDateLabel(lot.purchased_at)}
                          </p>
                        </div>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      <dl className="mt-4 grid gap-2 text-sm">
                        <FieldRow label="Proveedor" value={lot.supplier_name || 'Sin proveedor'} />
                        <FieldRow label="Cajas" value={<span className="tabular-nums">{lot.boxes_qty}</span>} />
                        <FieldRow label="Total" value={<span className="tabular-nums">{formatGrams(lot.total_grams)}</span>} />
                        <FieldRow label="Restante" value={<span className="font-medium tabular-nums">{formatGrams(lot.remaining_grams)}</span>} />
                        <FieldRow label="Valor" value={<span className="font-medium tabular-nums">{formatMoney(remainingLotValue(lot))}</span>} />
                      </dl>
                    </MobileCard>
                  )
                })}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Fecha</th>
                      <th className="px-4 py-3 font-medium">Lote</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Proveedor</th>
                      <th className="px-4 py-3 font-medium">Cajas</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Restante</th>
                      <th className="px-4 py-3 font-medium">Valor remanente</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLots.map((lot) => {
                      const status = inventoryStatus(toNumber(lot.remaining_grams))

                      return (
                        <tr key={lot.id} className="border-t">
                          <td className="px-4 py-4 text-muted-foreground sm:px-5">{formatDateLabel(lot.purchased_at)}</td>
                          <td className="px-4 py-4 font-medium">{lot.lot_code}</td>
                          <td className="px-4 py-4 text-muted-foreground">{lot.product_sku}</td>
                          <td className="px-4 py-4 text-muted-foreground">{lot.supplier_name || 'Sin proveedor'}</td>
                          <td className="px-4 py-4 tabular-nums">{lot.boxes_qty}</td>
                          <td className="px-4 py-4 tabular-nums">{formatGrams(lot.total_grams)}</td>
                          <td className="px-4 py-4 font-medium tabular-nums">{formatGrams(lot.remaining_grams)}</td>
                          <td className="px-4 py-4 font-medium tabular-nums">{formatMoney(remainingLotValue(lot))}</td>
                          <td className="px-4 py-4 sm:px-5">
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </DesktopTable>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CatalogWorkspace(props: CatalogWorkspaceProps) {
  switch (props.section) {
    case 'suppliers':
      return <SuppliersSection suppliers={props.suppliers} />
    case 'products':
      return <ProductsSection products={props.products} />
    case 'portions':
      return <PortionsSection products={props.products} />
    case 'customers':
      return <CustomersSection customers={props.customers} />
    case 'lots':
      return <LotsSection inventoryLots={props.inventoryLots} />
  }
}

export { CatalogWorkspace }
