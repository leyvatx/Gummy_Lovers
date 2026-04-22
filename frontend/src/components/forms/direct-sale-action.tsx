import { type FormEvent, useMemo, useState } from 'react'
import { ShoppingBag } from 'lucide-react'

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

type DirectSaleActionProps = {
  user: AuthUser
  products: Product[]
  onCreated: () => Promise<void>
}

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo guardar la venta.'
}

function formatGrams(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('es-MX', { maximumFractionDigits: 2 })} kg`
  }

  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })} g`
}

function DirectSaleAction({ user, products, onCreated }: DirectSaleActionProps) {
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState('')
  const [portion, setPortion] = useState('')
  const [portionsQty, setPortionsQty] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === product),
    [product, products],
  )
  const activePortions = useMemo(
    () => selectedProduct?.portions.filter((item) => item.active) ?? [],
    [selectedProduct],
  )
  const selectedPortion = useMemo(
    () => activePortions.find((item) => item.id === portion),
    [activePortions, portion],
  )
  const quantity = Number(portionsQty)
  const price = Number(unitPrice)
  const saleTotal = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0
  const estimatedGrams =
    selectedProduct && selectedPortion && Number.isFinite(quantity)
      ? quantity * selectedPortion.pieces_per_portion * toNumber(selectedProduct.grams_per_piece)
      : 0

  function handleProductChange(value: string) {
    setProduct(value)
    setPortion('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createDirectSale({
        product,
        portion,
        portions_qty: Number(portionsQty),
        unit_price: unitPrice,
        method,
        reference,
      })
      setOpen(false)
      setPortionsQty('1')
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="w-full gap-1 px-2 text-xs min-[380px]:gap-2 min-[380px]:text-sm sm:w-auto sm:px-4">
          <ShoppingBag />
          <span className="min-[360px]:hidden">Venta</span>
          <span className="hidden min-[360px]:inline">Venta propia</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[calc(100vw-1rem)] max-w-none overflow-y-auto sm:w-[420px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Registrar venta propia</SheetTitle>
          <SheetDescription>La venta se registra como pagada y ligada a tu sesión.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="rounded-xl border bg-muted/45 p-3 text-sm">
            <p className="font-medium">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">Socio vendedor desde sesión activa</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="direct-sale-product">Producto</Label>
            <Select value={product} onValueChange={handleProductChange}>
              <SelectTrigger id="direct-sale-product">
                <SelectValue placeholder="Selecciona producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} - {formatGrams(toNumber(item.available_grams))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="direct-sale-portion">Tamaño</Label>
            <Select value={portion} onValueChange={setPortion} disabled={!selectedProduct}>
              <SelectTrigger id="direct-sale-portion">
                <SelectValue placeholder="Selecciona tamaño" />
              </SelectTrigger>
              <SelectContent>
                {activePortions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} - {item.pieces_per_portion} piezas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 min-[380px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="direct-sale-quantity">Porciones</Label>
              <Input
                id="direct-sale-quantity"
                type="number"
                min="1"
                step="1"
                value={portionsQty}
                onChange={(event) => setPortionsQty(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="direct-sale-price">Precio por porción</Label>
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
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{formatMoney(saleTotal)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted-foreground">Inventario estimado</span>
              <span className="font-medium tabular-nums">{formatGrams(estimatedGrams)}</span>
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving || !product || !portion || !unitPrice || products.length === 0}>
            {isSaving ? 'Guardando...' : 'Guardar venta'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { DirectSaleAction }
