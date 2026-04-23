import { useMemo } from 'react'

import {
  CustomerAction,
  CustomerPriceAction,
  InventoryLotAction,
  PortionAction,
  ProductAction,
  SupplierAction,
} from '@/components/forms/catalog-actions'
import type { AppSection } from '@/components/layout/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  toNumber,
  type AuthUser,
  type Customer,
  type CustomerPrice,
  type InventoryLot,
  type Product,
  type Supplier,
} from '@/lib/api'
import { formatGrams, formatMoney } from '@/lib/format'

type CatalogWorkspaceProps = {
  section: Exclude<AppSection, 'dashboard'>
  user: AuthUser
  customers: Customer[]
  customerPrices: CustomerPrice[]
  inventoryLots: InventoryLot[]
  products: Product[]
  suppliers: Supplier[]
  onRefresh: () => Promise<void>
}

function HeaderAction({
  action,
  countLabel,
}: {
  action: React.ReactNode
  countLabel: string
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{countLabel}</Badge>
      </div>
      <div>{action}</div>
    </section>
  )
}

function SuppliersSection({
  suppliers,
  onRefresh,
}: Pick<CatalogWorkspaceProps, 'suppliers' | 'onRefresh'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction
        countLabel={`${suppliers.length} registro(s)`}
        action={<SupplierAction onCreated={onRefresh} />}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Tabla de proveedores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {suppliers.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Todavia no hay proveedores registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Nombre</th>
                    <th className="px-4 py-3 font-medium">Telefono</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-t">
                      <td className="px-4 py-4 font-medium sm:px-5">{supplier.name}</td>
                      <td className="px-4 py-4 text-muted-foreground">{supplier.phone || 'Sin telefono'}</td>
                      <td className="px-4 py-4 text-muted-foreground sm:px-5">{supplier.notes || 'Sin notas'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProductsSection({
  products,
  onRefresh,
}: Pick<CatalogWorkspaceProps, 'products' | 'onRefresh'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction
        countLabel={`${products.length} activo(s)`}
        action={<ProductAction onCreated={onRefresh} />}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Tabla de productos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Todavia no hay productos registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Producto</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Gramos por pieza</th>
                    <th className="px-4 py-3 font-medium">Disponible</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Porciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-t">
                      <td className="px-4 py-4 font-medium sm:px-5">{product.name}</td>
                      <td className="px-4 py-4 text-muted-foreground">{product.sku}</td>
                      <td className="px-4 py-4 text-muted-foreground tabular-nums">{formatGrams(product.grams_per_piece)}</td>
                      <td className="px-4 py-4 font-medium tabular-nums">{formatGrams(product.available_grams)}</td>
                      <td className="px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap gap-2">
                          {product.portions.filter((portion) => portion.active).map((portion) => (
                            <Badge key={portion.id} variant="secondary">
                              {portion.name} · {portion.pieces_per_portion} pzs
                            </Badge>
                          ))}
                          {product.portions.filter((portion) => portion.active).length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sin porciones</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PortionsSection({
  products,
  onRefresh,
}: Pick<CatalogWorkspaceProps, 'products' | 'onRefresh'>) {
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

  return (
    <div className="grid gap-5">
      <HeaderAction
        countLabel={`${portions.length} registro(s)`}
        action={<PortionAction products={products} onCreated={onRefresh} />}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Tabla de porciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {portions.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Todavia no hay porciones registradas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Producto</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Piezas</th>
                  </tr>
                </thead>
                <tbody>
                  {portions.map((portion) => (
                    <tr key={portion.id} className="border-t">
                      <td className="px-4 py-4 font-medium sm:px-5">{portion.productName}</td>
                      <td className="px-4 py-4 text-muted-foreground">{portion.product_sku}</td>
                      <td className="px-4 py-4 text-muted-foreground">{portion.name}</td>
                      <td className="px-4 py-4 font-medium tabular-nums sm:px-5">{portion.pieces_per_portion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CustomersSection({
  customers,
  onRefresh,
}: Pick<CatalogWorkspaceProps, 'customers' | 'onRefresh'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction
        countLabel={`${customers.length} registro(s)`}
        action={<CustomerAction onCreated={onRefresh} />}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Tabla de clientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Todavia no hay clientes registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Cliente</th>
                    <th className="px-4 py-3 font-medium">Contacto</th>
                    <th className="px-4 py-3 font-medium">Telefono</th>
                    <th className="px-4 py-3 font-medium">Direccion</th>
                    <th className="px-4 py-3 font-medium">Limite</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-t">
                      <td className="px-4 py-4 font-medium sm:px-5">{customer.name}</td>
                      <td className="px-4 py-4 text-muted-foreground">{customer.contact_name || 'Sin contacto'}</td>
                      <td className="px-4 py-4 text-muted-foreground">{customer.phone || 'Sin telefono'}</td>
                      <td className="px-4 py-4 text-muted-foreground">{customer.address || 'Sin direccion'}</td>
                      <td className="px-4 py-4 tabular-nums">{formatMoney(customer.credit_limit)}</td>
                      <td className="px-4 py-4 font-medium tabular-nums sm:px-5">{formatMoney(customer.outstanding_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PricesSection({
  customers,
  customerPrices,
  products,
  onRefresh,
}: Pick<CatalogWorkspaceProps, 'customers' | 'customerPrices' | 'products' | 'onRefresh'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction
        countLabel={`${customerPrices.length} registro(s)`}
        action={<CustomerPriceAction customers={customers} products={products} onCreated={onRefresh} />}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Tabla de precios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customerPrices.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Todavia no hay precios registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Cliente</th>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Porcion</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPrices.map((price) => (
                    <tr key={price.id} className="border-t">
                      <td className="px-4 py-4 font-medium sm:px-5">{price.customer_name}</td>
                      <td className="px-4 py-4 text-muted-foreground">{price.product_sku}</td>
                      <td className="px-4 py-4 text-muted-foreground">{price.portion_name}</td>
                      <td className="px-4 py-4 font-medium tabular-nums sm:px-5">{formatMoney(price.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LotsSection({
  inventoryLots,
  onRefresh,
  products,
  suppliers,
  user,
}: Pick<CatalogWorkspaceProps, 'inventoryLots' | 'onRefresh' | 'products' | 'suppliers' | 'user'>) {
  const sortedLots = useMemo(
    () =>
      [...inventoryLots].sort((left, right) => {
        return right.purchased_at.localeCompare(left.purchased_at) || right.lot_code.localeCompare(left.lot_code)
      }),
    [inventoryLots],
  )

  return (
    <div className="grid gap-5">
      <HeaderAction
        countLabel={`${sortedLots.length} registro(s)`}
        action={<InventoryLotAction user={user} products={products} suppliers={suppliers} onCreated={onRefresh} />}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Tabla de lotes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedLots.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Todavia no hay lotes registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-5">Fecha</th>
                    <th className="px-4 py-3 font-medium">Lote</th>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">Cajas</th>
                    <th className="px-4 py-3 font-medium">Bolsas/caja</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Restante</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLots.map((lot) => {
                    const remainingRatio =
                      toNumber(lot.total_grams) > 0 ? toNumber(lot.remaining_grams) / toNumber(lot.total_grams) : 0

                    return (
                      <tr key={lot.id} className="border-t">
                        <td className="px-4 py-4 text-muted-foreground sm:px-5">{lot.purchased_at}</td>
                        <td className="px-4 py-4 font-medium">{lot.lot_code}</td>
                        <td className="px-4 py-4 text-muted-foreground">{lot.product_sku}</td>
                        <td className="px-4 py-4 text-muted-foreground">{lot.supplier_name || 'Sin proveedor'}</td>
                        <td className="px-4 py-4 tabular-nums">{lot.boxes_qty}</td>
                        <td className="px-4 py-4 tabular-nums">{lot.bags_per_box}</td>
                        <td className="px-4 py-4 tabular-nums">{formatGrams(lot.total_grams)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium tabular-nums">{formatGrams(lot.remaining_grams)}</span>
                            <span className="text-xs text-muted-foreground">
                              {Math.max(0, Math.round(remainingRatio * 100))}% disponible
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium tabular-nums sm:px-5">{formatMoney(lot.total_cost)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CatalogWorkspace(props: CatalogWorkspaceProps) {
  switch (props.section) {
    case 'suppliers':
      return <SuppliersSection suppliers={props.suppliers} onRefresh={props.onRefresh} />
    case 'products':
      return <ProductsSection products={props.products} onRefresh={props.onRefresh} />
    case 'portions':
      return <PortionsSection products={props.products} onRefresh={props.onRefresh} />
    case 'customers':
      return <CustomersSection customers={props.customers} onRefresh={props.onRefresh} />
    case 'prices':
      return (
        <PricesSection
          customers={props.customers}
          customerPrices={props.customerPrices}
          products={props.products}
          onRefresh={props.onRefresh}
        />
      )
    case 'lots':
      return (
        <LotsSection
          inventoryLots={props.inventoryLots}
          onRefresh={props.onRefresh}
          products={props.products}
          suppliers={props.suppliers}
          user={props.user}
        />
      )
  }
}

export { CatalogWorkspace }
