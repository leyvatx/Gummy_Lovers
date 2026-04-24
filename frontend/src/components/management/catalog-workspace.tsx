import { type ReactNode, useMemo, useState } from 'react'
import { Candy, Search, Store } from 'lucide-react'

import type { AppSection } from '@/components/layout/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toNumber, type Product, type Supplier } from '@/lib/api'

type CatalogWorkspaceProps = {
  section: Exclude<AppSection, 'dashboard'>
  products: Product[]
  suppliers: Supplier[]
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

function formatUnits(value: string | number) {
  const units = toNumber(value)
  return `${units.toLocaleString('es-MX', { maximumFractionDigits: 0 })} pieza${units === 1 ? '' : 's'}`
}

function productStatus(availableUnits: number) {
  if (availableUnits <= 0) {
    return {
      label: 'Sin existencia',
      className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100',
    }
  }

  if (availableUnits < 10) {
    return {
      label: 'Bajo',
      className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-100',
    }
  }

  return {
    label: 'Disponible',
    className: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-400/20 dark:bg-pink-400/10 dark:text-pink-100',
  }
}

function SectionToolbar({
  countLabel,
  icon: Icon,
  placeholder,
  query,
  onQueryChange,
}: {
  countLabel: string
  icon: typeof Candy
  placeholder: string
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <section className="grid gap-3 rounded-2xl border bg-card/80 p-3 shadow-[var(--ui-shadow-soft)] md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl border bg-pink-50 text-pink-700 dark:bg-pink-400/10 dark:text-pink-200">
          <Icon className="size-4" />
        </span>
        <Badge variant="outline" className="max-w-full truncate rounded-full px-3 py-1">
          {countLabel}
        </Badge>
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

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-sm text-muted-foreground">{label}</div>
}

function MobileCards({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 p-4 md:hidden">{children}</div>
}

function MobileCard({ children }: { children: ReactNode }) {
  return <article className="rounded-2xl border bg-background/70 p-4 shadow-sm">{children}</article>
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function DesktopTable({ children }: { children: ReactNode }) {
  return <div className="hidden overflow-x-auto md:block">{children}</div>
}

function SuppliersSection({ suppliers }: Pick<CatalogWorkspaceProps, 'suppliers'>) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearch(query)
  const filteredSuppliers = useMemo(
    () => suppliers.filter((supplier) => matchesQuery(normalizedQuery, [supplier.name, supplier.phone, supplier.notes])),
    [normalizedQuery, suppliers],
  )

  return (
    <div className="grid gap-4">
      <SectionToolbar
        countLabel={`${filteredSuppliers.length} de ${suppliers.length} proveedor${suppliers.length === 1 ? '' : 'es'}`}
        icon={Store}
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
            <EmptyState label="No hay proveedores para mostrar." />
          ) : (
            <>
              <MobileCards>
                {filteredSuppliers.map((supplier) => (
                  <MobileCard key={supplier.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{supplier.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{supplier.phone || 'Sin teléfono'}</p>
                      </div>
                      <Badge variant="outline" className="border-pink-200 bg-pink-50 text-pink-700">
                        Proveedor
                      </Badge>
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <FieldRow label="Notas" value={supplier.notes || 'Sin notas'} />
                    </dl>
                  </MobileCard>
                ))}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Nombre</th>
                      <th className="px-4 py-3 font-medium">Teléfono</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-t">
                        <td className="px-4 py-4 font-medium sm:px-5">{supplier.name}</td>
                        <td className="px-4 py-4 text-muted-foreground">{supplier.phone || 'Sin teléfono'}</td>
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
    () => products.filter((product) => matchesQuery(normalizedQuery, [product.name, product.sku])),
    [normalizedQuery, products],
  )

  const totalUnits = products.reduce((sum, product) => sum + toNumber(product.available_grams), 0)

  return (
    <div className="grid gap-4">
      <SectionToolbar
        countLabel={`${filteredProducts.length} de ${products.length} producto${products.length === 1 ? '' : 's'} · ${formatUnits(totalUnits)}`}
        icon={Candy}
        placeholder="Buscar gomita o SKU"
        query={query}
        onQueryChange={setQuery}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <EmptyState label="No hay productos para mostrar." />
          ) : (
            <>
              <MobileCards>
                {filteredProducts.map((product) => {
                  const status = productStatus(toNumber(product.available_grams))

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
                        <FieldRow
                          label="Existencia"
                          value={<span className="font-semibold tabular-nums">{formatUnits(product.available_grams)}</span>}
                        />
                      </dl>
                    </MobileCard>
                  )
                })}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Producto</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Existencia</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const status = productStatus(toNumber(product.available_grams))

                      return (
                        <tr key={product.id} className="border-t">
                          <td className="px-4 py-4 font-medium sm:px-5">{product.name}</td>
                          <td className="px-4 py-4 text-muted-foreground">{product.sku}</td>
                          <td className="px-4 py-4 font-semibold tabular-nums">{formatUnits(product.available_grams)}</td>
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
  }
}

export { CatalogWorkspace }
