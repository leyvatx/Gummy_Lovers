import { type FormEvent, useMemo, useState } from 'react'
import { Store } from 'lucide-react'

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
import { createSupplierSale, toNumber, type ApiError, type Product, type Supplier } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { recoveryPriceForPortion, salePortionLabel, salePortions } from '@/lib/sale-units'

type SupplierSaleActionProps = {
  products: Product[]
  suppliers: Supplier[]
  onCreated: () => Promise<void>
}

const sheetClassName =
  'w-full max-w-none overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:max-w-none sm:p-6'

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo guardar la venta a proveedor.'
}

function formatUnits(value: string | number) {
  const units = toNumber(value)
  return `${units.toLocaleString('es-MX', { maximumFractionDigits: 0 })} pieza${units === 1 ? '' : 's'}`
}

function SupplierSaleAction({ products, suppliers, onCreated }: SupplierSaleActionProps) {
  const [open, setOpen] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [product, setProduct] = useState('')
  const [portion, setPortion] = useState('')
  const [quantityValue, setQuantityValue] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [paidAmount, setPaidAmount] = useState('0')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === product),
    [product, products],
  )
  const availablePortions = useMemo(() => salePortions(selectedProduct), [selectedProduct])
  const selectedUnit = useMemo(
    () => availablePortions.find((item) => item.id === portion) ?? null,
    [availablePortions, portion],
  )
  const quantity = Number(quantityValue)
  const price = Number(unitPrice)
  const saleTotal = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0
  const recoveryUnitPrice = recoveryPriceForPortion(selectedUnit)
  const margin = Number.isFinite(quantity) && Number.isFinite(price) ? (price - recoveryUnitPrice) * quantity : 0

  function selectProductDefaults(productId: string) {
    const nextProduct = products.find((item) => item.id === productId)
    const nextPortions = salePortions(nextProduct)
    const nextPortion = nextPortions[0] ?? null

    setProduct(nextProduct?.id ?? '')
    setPortion(nextPortion?.id ?? '')
    setUnitPrice(nextPortion ? String(recoveryPriceForPortion(nextPortion)) : '')
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      return
    }

    if (!suppliers.some((item) => item.id === supplier)) {
      setSupplier(suppliers[0]?.id ?? '')
    }

    if (!products.some((item) => item.id === product)) {
      selectProductDefaults(products[0]?.id ?? '')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createSupplierSale({
        supplier,
        product,
        portion,
        quantity: Number(quantityValue),
        unit_price: unitPrice,
        paid_amount: paidAmount || '0',
        method,
        reference,
      })
      setOpen(false)
      setSupplier('')
      setProduct('')
      setPortion('')
      setQuantityValue('1')
      setUnitPrice('')
      setPaidAmount('0')
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
        <Button className="quick-action-button max-sm:size-10 max-sm:px-0" title="Venta a proveedor" disabled={suppliers.length === 0 || products.length === 0}>
          <Store />
          <span className="hidden sm:inline">Venta a proveedor</span>
          <span className="sr-only sm:hidden">Venta a proveedor</span>
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar venta a proveedor</SheetTitle>
          <SheetDescription>G1 recupera $15 y G2 recupera $30; puedes cambiar el precio de venta.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4 pb-6" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="supplier-sale-supplier">Proveedor</Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger id="supplier-sale-supplier">
                <SelectValue placeholder="Selecciona proveedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-sale-product">Producto</Label>
            <Select
              value={product}
              onValueChange={(value) => {
                selectProductDefaults(value)
              }}
            >
              <SelectTrigger id="supplier-sale-product">
                <SelectValue placeholder="Selecciona producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {formatUnits(item.available_grams)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-sale-portion">Tipo</Label>
            <Select
              value={portion}
              onValueChange={(value) => {
                setPortion(value)
                const nextPortion = availablePortions.find((item) => item.id === value)
                setUnitPrice(nextPortion ? String(recoveryPriceForPortion(nextPortion)) : '')
              }}
            >
              <SelectTrigger id="supplier-sale-portion">
                <SelectValue placeholder="Selecciona G1 o G2" />
              </SelectTrigger>
              <SelectContent>
                {availablePortions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {salePortionLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 min-[380px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="supplier-sale-quantity">Cantidad</Label>
              <Input
                id="supplier-sale-quantity"
                type="number"
                min="1"
                step="1"
                value={quantityValue}
                onChange={(event) => setQuantityValue(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-sale-price">Precio de venta editable</Label>
              <Input
                id="supplier-sale-price"
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
              <Label htmlFor="supplier-sale-paid">Cobro recibido</Label>
              <Input
                id="supplier-sale-paid"
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-sale-method">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="supplier-sale-method">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-sale-reference">Referencia</Label>
            <Input
              id="supplier-sale-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="rounded-xl border bg-background/55 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Recuperado fijo</span>
              <span className="font-semibold tabular-nums">{formatMoney(recoveryUnitPrice)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted-foreground">Ganancia / pérdida</span>
              <span className="font-semibold tabular-nums">{formatMoney(margin)}</span>
            </div>
            <div className="my-3 h-px bg-border" />
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{formatMoney(saleTotal)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted-foreground">Pendiente</span>
              <span className="font-semibold tabular-nums">{formatMoney(Math.max(0, saleTotal - toNumber(paidAmount)))}</span>
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving || !supplier || !product || !portion || !unitPrice || suppliers.length === 0 || products.length === 0}>
            {isSaving ? 'Guardando...' : 'Guardar venta'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { SupplierSaleAction }
