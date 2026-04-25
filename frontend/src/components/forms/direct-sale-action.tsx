import { type FormEvent, useMemo, useState } from 'react'
import { Candy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  SheetTrigger,
} from '@/components/ui/sheet'
import { createDirectSale, toNumber, type ApiError, type AuthUser, type Product } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { productRecoveryPrice, salePortionForProduct } from '@/lib/sale-units'

type DirectSaleActionProps = {
  user: AuthUser
  products: Product[]
  onCreated: () => Promise<void>
}

const sheetClassName =
  'w-full max-w-none overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:max-w-none sm:p-6'

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo guardar la venta.'
}

function formatUnits(value: string | number) {
  const units = toNumber(value)
  return `${units.toLocaleString('es-MX', { maximumFractionDigits: 0 })} pieza${units === 1 ? '' : 's'}`
}

function DirectSaleAction({ user, products, onCreated }: DirectSaleActionProps) {
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState('')
  const [quantityValue, setQuantityValue] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === product),
    [product, products],
  )
  const selectedUnit = useMemo(() => salePortionForProduct(selectedProduct), [selectedProduct])
  const quantity = Number(quantityValue)
  const price = Number(unitPrice)
  const saleTotal = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0
  const recoveryUnitPrice = productRecoveryPrice(selectedProduct)
  const extraPerUnit = Number.isFinite(price) ? price - recoveryUnitPrice : 0
  const directSaleExtra = Number.isFinite(quantity) ? extraPerUnit * quantity : 0

  function selectProductDefaults(productId: string) {
    const nextProduct = products.find((item) => item.id === productId)

    setProduct(nextProduct?.id ?? '')
    setUnitPrice(nextProduct ? String(productRecoveryPrice(nextProduct)) : '')
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (nextOpen && !products.some((item) => item.id === product)) {
      selectProductDefaults(products[0]?.id ?? '')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!selectedProduct || !selectedUnit) {
      setError('Este producto no tiene unidad interna para vender. Vuelve a guardarlo desde Productos.')
      return
    }

    if (recoveryUnitPrice <= 0) {
      setError('Configura el precio a recuperar de este producto antes de vender.')
      return
    }

    setIsSaving(true)

    try {
      await createDirectSale({
        product: selectedProduct.id,
        portion: selectedUnit.id,
        portions_qty: Number(quantityValue),
        unit_price: unitPrice,
        method,
        reference,
      })
      setOpen(false)
      setProduct('')
      setQuantityValue('1')
      setUnitPrice('')
      setReference('')
      await onCreated()
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button className="quick-action-button max-sm:size-10 max-sm:px-0" title="Venta propia">
          <Candy />
          <span className="hidden sm:inline">Venta propia</span>
          <span className="sr-only sm:hidden">Venta propia</span>
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar venta propia</SheetTitle>
          <SheetDescription>El precio a recuperar sale del producto; puedes cambiar el precio de venta.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4 pb-6" onSubmit={handleSubmit}>
          <div className="rounded-xl border bg-muted/45 p-3 text-sm">
            <p className="font-medium">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">Socio vendedor desde la sesión activa</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="direct-sale-product">Nombre</Label>
            <Select value={product} onValueChange={selectProductDefaults}>
              <SelectTrigger id="direct-sale-product">
                <SelectValue placeholder="Selecciona nombre" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {formatUnits(item.available_grams)} · recupera {formatMoney(productRecoveryPrice(item))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 min-[380px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="direct-sale-quantity">Cantidad</Label>
              <Input
                id="direct-sale-quantity"
                type="number"
                min="1"
                step="1"
                value={quantityValue}
                onChange={(event) => setQuantityValue(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="direct-sale-price">Precio de venta</Label>
              <Input
                id="direct-sale-price"
                type="number"
                min="0.01"
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 min-[380px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="direct-sale-method">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="direct-sale-method">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="direct-sale-reference">Referencia</Label>
              <Input
                id="direct-sale-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="rounded-xl border bg-background/55 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Precio a recuperar</span>
              <span className="font-medium tabular-nums">{formatMoney(recoveryUnitPrice)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted-foreground">Ganancia / pérdida</span>
              <span className="font-medium tabular-nums">{formatMoney(directSaleExtra)}</span>
            </div>
            <div className="my-3 h-px bg-border" />
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{formatMoney(saleTotal)}</span>
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving || !selectedProduct || !selectedUnit || !unitPrice || products.length === 0}>
            {isSaving ? 'Guardando...' : 'Guardar venta'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { DirectSaleAction }
