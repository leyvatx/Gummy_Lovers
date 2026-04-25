import { type FormEvent, type HTMLAttributes, type ReactNode, useMemo, useState } from 'react'
import { Candy, Eye, Pencil, Search, Store, Trash2 } from 'lucide-react'

import type { AppSection } from '@/components/layout/app-sidebar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RowContextMenu, type RowContextMenuTarget, useRowContextMenu } from '@/components/ui/row-context-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteProduct,
  deleteSupplier,
  toNumber,
  updateProduct,
  updateSupplier,
  type ApiError,
  type Partner,
  type Product,
  type Supplier,
} from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { productRecoveryPrice } from '@/lib/sale-units'
import { cn } from '@/lib/utils'

type CatalogWorkspaceProps = {
  section: Extract<AppSection, 'suppliers' | 'products'>
  partners: Partner[]
  products: Product[]
  suppliers: Supplier[]
  onChanged: () => Promise<void>
}

type RowMode = 'details' | 'edit' | null

const sheetClassName =
  'w-full max-w-none overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:max-w-none sm:p-6'

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

function errorMessage(error: unknown, fallbackMessage: string) {
  return (error as ApiError)?.message ?? fallbackMessage
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

function MobileCard({ children, className, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <article className={cn('rounded-2xl border bg-background/70 p-4 shadow-sm', className)} {...props}>
      {children}
    </article>
  )
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

function SupplierContextActions({
  supplier,
  partners,
  menuTarget,
  onCloseMenu,
  onChanged,
}: {
  supplier: Supplier
  partners: Partner[]
  menuTarget: RowContextMenuTarget
  onCloseMenu: () => void
  onChanged: () => Promise<void>
}) {
  const [mode, setMode] = useState<RowMode>(null)
  const [name, setName] = useState(supplier.name)
  const [phone, setPhone] = useState(supplier.phone)
  const [partner, setPartner] = useState(supplier.partner ?? 'none')
  const [notes, setNotes] = useState(supplier.notes)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await updateSupplier(supplier.id, {
        name,
        partner: partner === 'none' ? '' : partner,
        phone,
        notes,
      })
      setMode(null)
      await onChanged()
    } catch (editError) {
      setError(errorMessage(editError, 'No se pudo actualizar el proveedor.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    setDeleteError('')
    setIsDeleting(true)
    try {
      await deleteSupplier(supplier.id)
      setIsDeleteOpen(false)
      await onChanged()
    } catch (deleteError) {
      setDeleteError(errorMessage(deleteError, 'No se pudo eliminar el proveedor.'))
    } finally {
      setIsDeleting(false)
    }
  }

  function openEdit() {
    setName(supplier.name)
    setPhone(supplier.phone)
    setPartner(supplier.partner ?? 'none')
    setNotes(supplier.notes)
    setError('')
    setMode('edit')
  }

  return (
    <>
      <RowContextMenu
        target={menuTarget}
        rowId={supplier.id}
        onClose={onCloseMenu}
        items={[
          { icon: <Eye className="size-4" />, label: 'Ver detalles', onSelect: () => setMode('details') },
          { icon: <Pencil className="size-4" />, label: 'Editar', onSelect: openEdit },
          { destructive: true, icon: <Trash2 className="size-4" />, label: 'Eliminar', onSelect: () => setIsDeleteOpen(true) },
        ]}
      />

      <Sheet open={mode !== null} onOpenChange={(open) => setMode(open ? mode : null)}>
        <SheetContent className={sheetClassName}>
          {mode === 'details' ? (
            <>
              <SheetHeader>
                <SheetTitle>{supplier.name}</SheetTitle>
                <SheetDescription>Detalle del proveedor.</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-3 text-sm">
                <FieldRow label="Teléfono" value={supplier.phone || 'Sin teléfono'} />
                <FieldRow label="Socio vinculado" value={supplier.partner_name || 'Ninguno'} />
                <FieldRow label="Notas" value={supplier.notes || 'Sin notas'} />
              </dl>
            </>
          ) : null}

          {mode === 'edit' ? (
            <>
              <SheetHeader>
                <SheetTitle>Editar proveedor</SheetTitle>
                <SheetDescription>Actualiza la información del proveedor.</SheetDescription>
              </SheetHeader>
              <form className="grid gap-4 pb-6" onSubmit={handleEdit}>
                <div className="grid gap-2">
                  <Label htmlFor={`supplier-name-${supplier.id}`}>Nombre</Label>
                  <Input id={`supplier-name-${supplier.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`supplier-phone-${supplier.id}`}>Teléfono</Label>
                  <Input id={`supplier-phone-${supplier.id}`} value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`supplier-partner-${supplier.id}`}>Socio vinculado</Label>
                  <Select value={partner} onValueChange={setPartner}>
                    <SelectTrigger id={`supplier-partner-${supplier.id}`}>
                      <SelectValue placeholder="Sin socio vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin socio vinculado</SelectItem>
                      {partners.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`supplier-notes-${supplier.id}`}>Notas</Label>
                  <Textarea id={`supplier-notes-${supplier.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>
                {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </form>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              El proveedor se eliminará por completo junto con sus ventas vinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border bg-muted/45 p-3 text-sm">
            <p className="font-medium">{supplier.name}</p>
            <p className="text-xs text-muted-foreground">{supplier.partner_name || 'Sin socio vinculado'}</p>
          </div>
          {deleteError ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteConfirm()
              }}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ProductContextActions({
  product,
  menuTarget,
  onCloseMenu,
  onChanged,
}: {
  product: Product
  menuTarget: RowContextMenuTarget
  onCloseMenu: () => void
  onChanged: () => Promise<void>
}) {
  const [mode, setMode] = useState<RowMode>(null)
  const [sku, setSku] = useState(product.sku)
  const [name, setName] = useState(product.name)
  const [recoveryPrice, setRecoveryPrice] = useState(String(product.recovery_price))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await updateProduct(product.id, {
        sku,
        name,
        recovery_price: recoveryPrice,
      })
      setMode(null)
      await onChanged()
    } catch (editError) {
      setError(errorMessage(editError, 'No se pudo actualizar el producto.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    setDeleteError('')
    setIsDeleting(true)
    try {
      await deleteProduct(product.id)
      setIsDeleteOpen(false)
      await onChanged()
    } catch (deleteError) {
      setDeleteError(errorMessage(deleteError, 'No se pudo eliminar el producto.'))
    } finally {
      setIsDeleting(false)
    }
  }

  function openEdit() {
    setSku(product.sku)
    setName(product.name)
    setRecoveryPrice(String(product.recovery_price))
    setError('')
    setMode('edit')
  }

  return (
    <>
      <RowContextMenu
        target={menuTarget}
        rowId={product.id}
        onClose={onCloseMenu}
        items={[
          { icon: <Eye className="size-4" />, label: 'Ver detalles', onSelect: () => setMode('details') },
          { icon: <Pencil className="size-4" />, label: 'Editar', onSelect: openEdit },
          { destructive: true, icon: <Trash2 className="size-4" />, label: 'Eliminar', onSelect: () => setIsDeleteOpen(true) },
        ]}
      />

      <Sheet open={mode !== null} onOpenChange={(open) => setMode(open ? mode : null)}>
        <SheetContent className={sheetClassName}>
          {mode === 'details' ? (
            <>
              <SheetHeader>
                <SheetTitle>{product.name}</SheetTitle>
                <SheetDescription>Detalle del producto.</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-3 text-sm">
                <FieldRow label="SKU" value={product.sku} />
                <FieldRow label="Precio a recuperar" value={<span className="tabular-nums">{formatMoney(productRecoveryPrice(product))}</span>} />
                <FieldRow label="Existencia" value={<span className="tabular-nums">{formatUnits(product.available_grams)}</span>} />
              </dl>
            </>
          ) : null}

          {mode === 'edit' ? (
            <>
              <SheetHeader>
                <SheetTitle>Editar producto</SheetTitle>
                <SheetDescription>Actualiza la gomita y su precio a recuperar.</SheetDescription>
              </SheetHeader>
              <form className="grid gap-4 pb-6" onSubmit={handleEdit}>
                <div className="grid gap-3 min-[420px]:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="grid gap-2">
                    <Label htmlFor={`product-sku-${product.id}`}>SKU</Label>
                    <Input id={`product-sku-${product.id}`} value={sku} onChange={(event) => setSku(event.target.value)} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`product-name-${product.id}`}>Nombre</Label>
                    <Input id={`product-name-${product.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`product-recovery-price-${product.id}`}>Precio a recuperar</Label>
                  <Input
                    id={`product-recovery-price-${product.id}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={recoveryPrice}
                    onChange={(event) => setRecoveryPrice(event.target.value)}
                    required
                  />
                </div>
                {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </form>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              El producto se eliminará por completo junto con su existencia y ventas vinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border bg-muted/45 p-3 text-sm">
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.sku}</p>
          </div>
          {deleteError ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteConfirm()
              }}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SuppliersSection({
  partners,
  suppliers,
  onChanged,
}: Pick<CatalogWorkspaceProps, 'partners' | 'suppliers' | 'onChanged'>) {
  const [query, setQuery] = useState('')
  const supplierContextMenu = useRowContextMenu()
  const normalizedQuery = normalizeSearch(query)
  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) =>
        matchesQuery(normalizedQuery, [supplier.name, supplier.phone, supplier.notes, supplier.partner_name]),
      ),
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
                  <MobileCard key={supplier.id} {...supplierContextMenu.getTargetProps(supplier.id)}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{supplier.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{supplier.phone || 'Sin teléfono'}</p>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <FieldRow label="Socio vinculado" value={supplier.partner_name || 'Ninguno'} />
                      <FieldRow label="Notas" value={supplier.notes || 'Sin notas'} />
                    </dl>
                    <SupplierContextActions
                      supplier={supplier}
                      partners={partners}
                      menuTarget={supplierContextMenu.target}
                      onCloseMenu={supplierContextMenu.close}
                      onChanged={onChanged}
                    />
                  </MobileCard>
                ))}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Nombre</th>
                      <th className="px-4 py-3 font-medium">Teléfono</th>
                      <th className="px-4 py-3 font-medium">Socio vinculado</th>
                      <th className="px-4 py-3 font-medium">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-t transition-colors hover:bg-muted/40" {...supplierContextMenu.getTargetProps(supplier.id)}>
                        <td className="px-4 py-4 font-medium sm:px-5">{supplier.name}</td>
                        <td className="px-4 py-4 text-muted-foreground">{supplier.phone || 'Sin teléfono'}</td>
                        <td className="px-4 py-4 text-muted-foreground">{supplier.partner_name || 'Ninguno'}</td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {supplier.notes || 'Sin notas'}
                          <SupplierContextActions
                            supplier={supplier}
                            partners={partners}
                            menuTarget={supplierContextMenu.target}
                            onCloseMenu={supplierContextMenu.close}
                            onChanged={onChanged}
                          />
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

function ProductsSection({
  products,
  onChanged,
}: Pick<CatalogWorkspaceProps, 'products' | 'onChanged'>) {
  const [query, setQuery] = useState('')
  const productContextMenu = useRowContextMenu()
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
                    <MobileCard key={product.id} {...productContextMenu.getTargetProps(product.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{product.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{product.sku}</p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                      <dl className="mt-4 grid gap-2 text-sm">
                        <FieldRow label="Precio a recuperar" value={<span className="font-semibold tabular-nums">{formatMoney(productRecoveryPrice(product))}</span>} />
                        <FieldRow label="Existencia" value={<span className="font-semibold tabular-nums">{formatUnits(product.available_grams)}</span>} />
                      </dl>
                      <ProductContextActions
                        product={product}
                        menuTarget={productContextMenu.target}
                        onCloseMenu={productContextMenu.close}
                        onChanged={onChanged}
                      />
                    </MobileCard>
                  )
                })}
              </MobileCards>

              <DesktopTable>
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Producto</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Precio a recuperar</th>
                      <th className="px-4 py-3 font-medium">Existencia</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const status = productStatus(toNumber(product.available_grams))

                      return (
                        <tr key={product.id} className="border-t transition-colors hover:bg-muted/40" {...productContextMenu.getTargetProps(product.id)}>
                          <td className="px-4 py-4 font-medium sm:px-5">{product.name}</td>
                          <td className="px-4 py-4 text-muted-foreground">{product.sku}</td>
                          <td className="px-4 py-4 font-semibold tabular-nums">{formatMoney(productRecoveryPrice(product))}</td>
                          <td className="px-4 py-4 font-semibold tabular-nums">{formatUnits(product.available_grams)}</td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                            <ProductContextActions
                              product={product}
                              menuTarget={productContextMenu.target}
                              onCloseMenu={productContextMenu.close}
                              onChanged={onChanged}
                            />
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
      return <SuppliersSection partners={props.partners} suppliers={props.suppliers} onChanged={props.onChanged} />
    case 'products':
      return <ProductsSection products={props.products} onChanged={props.onChanged} />
  }
}

export { CatalogWorkspace }
