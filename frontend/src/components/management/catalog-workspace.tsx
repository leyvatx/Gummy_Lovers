import { useMemo } from 'react'

import type { AppSection } from '@/components/layout/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  toNumber,
  type Customer,
  type CustomerPrice,
  type InventoryLot,
  type Product,
  type Supplier,
} from '@/lib/api'
import { formatGrams, formatMoney } from '@/lib/format'

type CatalogWorkspaceProps = {
  section: Exclude<AppSection, 'dashboard'>
  customers: Customer[]
  customerPrices: CustomerPrice[]
  inventoryLots: InventoryLot[]
  products: Product[]
  suppliers: Supplier[]
}

function HeaderAction({
  countLabel,
}: {
  countLabel: string
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{countLabel}</Badge>
      </div>
    </section>
  )
}

function SuppliersSection({
  suppliers,
}: Pick<CatalogWorkspaceProps, 'suppliers'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction countLabel={`${suppliers.length} registro(s)`} />

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
}: Pick<CatalogWorkspaceProps, 'products'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction countLabel={`${products.length} activo(s)`} />

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
}: Pick<CatalogWorkspaceProps, 'products'>) {
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
      <HeaderAction countLabel={`${portions.length} registro(s)`} />

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
}: Pick<CatalogWorkspaceProps, 'customers'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction countLabel={`${customers.length} registro(s)`} />

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
  customerPrices,
}: Pick<CatalogWorkspaceProps, 'customerPrices'>) {
  return (
    <div className="grid gap-5">
      <HeaderAction countLabel={`${customerPrices.length} registro(s)`} />

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
}: Pick<CatalogWorkspaceProps, 'inventoryLots'>) {
  const sortedLots = useMemo(
    () =>
      [...inventoryLots].sort((left, right) => {
        return right.purchased_at.localeCompare(left.purchased_at) || right.lot_code.localeCompare(left.lot_code)
      }),
    [inventoryLots],
  )

  return (
    <div className="grid gap-5">
      <HeaderAction countLabel={`${sortedLots.length} registro(s)`} />

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
      return <SuppliersSection suppliers={props.suppliers} />
    case 'products':
      return <ProductsSection products={props.products} />
    case 'portions':
      return <PortionsSection products={props.products} />
    case 'customers':
      return <CustomersSection customers={props.customers} />
    case 'prices':
      return <PricesSection customerPrices={props.customerPrices} />
    case 'lots':
      return <LotsSection inventoryLots={props.inventoryLots} />
  }
}

export { CatalogWorkspace }
