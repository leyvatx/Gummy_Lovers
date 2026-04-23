import { useMemo } from 'react'
import { Boxes, Package2, Truck, UserRoundPlus } from 'lucide-react'

import {
  CustomerAction,
  CustomerPriceAction,
  InventoryLotAction,
  PortionAction,
  ProductAction,
  SupplierAction,
} from '@/components/forms/catalog-actions'
import { WholesaleSaleAction } from '@/components/forms/wholesale-sale-action'
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
  user: AuthUser
  customers: Customer[]
  customerPrices: CustomerPrice[]
  inventoryLots: InventoryLot[]
  products: Product[]
  suppliers: Supplier[]
  onRefresh: () => Promise<void>
}

function CatalogWorkspace({
  user,
  customers,
  customerPrices,
  inventoryLots,
  products,
  suppliers,
  onRefresh,
}: CatalogWorkspaceProps) {
  const sortedLots = useMemo(
    () =>
      [...inventoryLots].sort((left, right) => {
        return right.purchased_at.localeCompare(left.purchased_at) || right.lot_code.localeCompare(left.lot_code)
      }),
    [inventoryLots],
  )

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Altas operativas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:pt-5">
            <p className="text-sm text-muted-foreground">
              Da de alta catalogos, precios, lotes y ventas mayoristas sin salir del panel.
            </p>

            <div className="flex flex-wrap gap-2">
              <WholesaleSaleAction
                customers={customers}
                customerPrices={customerPrices}
                products={products}
                onCreated={onRefresh}
              />
              <SupplierAction onCreated={onRefresh} />
              <ProductAction onCreated={onRefresh} />
              <PortionAction products={products} onCreated={onRefresh} />
              <CustomerAction onCreated={onRefresh} />
              <CustomerPriceAction customers={customers} products={products} onCreated={onRefresh} />
              <InventoryLotAction user={user} products={products} suppliers={suppliers} onCreated={onRefresh} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
                <Package2 className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Productos activos</p>
                <p className="text-2xl font-semibold tabular-nums">{products.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                <UserRoundPlus className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes mayoristas</p>
                <p className="text-2xl font-semibold tabular-nums">{customers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <Boxes className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lotes cargados</p>
                <p className="text-2xl font-semibold tabular-nums">{inventoryLots.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Productos y porciones</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Producto</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Gramos/pieza</th>
                  <th className="px-4 py-3 font-medium">Disponible</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Porciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t">
                    <td className="px-4 py-4 font-medium sm:px-5">{product.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{product.sku}</td>
                    <td className="px-4 py-4 tabular-nums text-muted-foreground">{formatGrams(product.grams_per_piece)}</td>
                    <td className="px-4 py-4 tabular-nums font-medium">{formatGrams(product.available_grams)}</td>
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
            {products.length === 0 ? (
              <div className="border-t p-6 text-center text-sm text-muted-foreground">
                Todavia no has registrado productos.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Proveedores</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:pt-5">
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavia no has registrado proveedores.</p>
            ) : (
              suppliers.map((supplier) => (
                <div key={supplier.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{supplier.name}</p>
                      <p className="text-sm text-muted-foreground">{supplier.phone || 'Sin telefono'}</p>
                    </div>
                    <Truck className="size-4 text-muted-foreground" />
                  </div>
                  {supplier.notes ? <p className="mt-3 text-sm text-muted-foreground">{supplier.notes}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Clientes mayoristas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Cliente</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Telefono</th>
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
                    <td className="px-4 py-4 tabular-nums">{formatMoney(customer.credit_limit)}</td>
                    <td className="px-4 py-4 font-medium tabular-nums sm:px-5">{formatMoney(customer.outstanding_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 ? (
              <div className="border-t p-6 text-center text-sm text-muted-foreground">
                Todavia no has registrado clientes mayoristas.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Precios mayoristas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
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
            {customerPrices.length === 0 ? (
              <div className="border-t p-6 text-center text-sm text-muted-foreground">
                Todavia no has registrado precios por cliente.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Lotes de inventario</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Fecha</th>
                  <th className="px-4 py-3 font-medium">Lote</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Cajas</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Restante</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Costo</th>
                </tr>
              </thead>
              <tbody>
                {sortedLots.map((lot) => {
                  const remainingRatio = toNumber(lot.total_grams) > 0 ? toNumber(lot.remaining_grams) / toNumber(lot.total_grams) : 0

                  return (
                    <tr key={lot.id} className="border-t">
                      <td className="px-4 py-4 text-muted-foreground sm:px-5">{lot.purchased_at}</td>
                      <td className="px-4 py-4 font-medium">{lot.lot_code}</td>
                      <td className="px-4 py-4 text-muted-foreground">{lot.product_sku}</td>
                      <td className="px-4 py-4 text-muted-foreground">{lot.supplier_name || 'Sin proveedor'}</td>
                      <td className="px-4 py-4 tabular-nums">{lot.boxes_qty}</td>
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
            {sortedLots.length === 0 ? (
              <div className="border-t p-6 text-center text-sm text-muted-foreground">
                Todavia no has registrado lotes de inventario.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export { CatalogWorkspace }
