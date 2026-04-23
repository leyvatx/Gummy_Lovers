import { type FormEvent, useMemo, useState } from 'react'
import { PackagePlus, Plus, Trash2 } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import {
  createWholesaleSale,
  toNumber,
  type ApiError,
  type Customer,
  type CustomerPrice,
  type Product,
} from '@/lib/api'
import { formatGrams, formatMoney } from '@/lib/format'

type WholesaleSaleActionProps = {
  customers: Customer[]
  customerPrices: CustomerPrice[]
  products: Product[]
  onCreated: () => Promise<void>
}

type SaleLineDraft = {
  id: string
  product: string
  portion: string
  portionsQty: string
}

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo guardar la venta mayorista.'
}

function makeLine(): SaleLineDraft {
  return {
    id: crypto.randomUUID(),
    product: '',
    portion: '',
    portionsQty: '1',
  }
}

function WholesaleSaleAction({
  customers,
  customerPrices,
  products,
  onCreated,
}: WholesaleSaleActionProps) {
  const [open, setOpen] = useState(false)
  const [customer, setCustomer] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<SaleLineDraft[]>([makeLine()])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const customerPriceMap = useMemo(() => {
    const entries = new Map<string, CustomerPrice>()

    for (const price of customerPrices) {
      entries.set(`${price.customer}:${price.product}:${price.portion}`, price)
    }

    return entries
  }, [customerPrices])

  const estimatedTotal = useMemo(() => {
    return lines.reduce((runningTotal, line) => {
      const unitPrice = customerPriceMap.get(`${customer}:${line.product}:${line.portion}`)
      return runningTotal + toNumber(unitPrice?.unit_price ?? 0) * Number(line.portionsQty || 0)
    }, 0)
  }, [customer, customerPriceMap, lines])

  const linesWithoutPrice = useMemo(() => {
    return lines.filter((line) => {
      if (!customer || !line.product || !line.portion) {
        return false
      }

      return !customerPriceMap.has(`${customer}:${line.product}:${line.portion}`)
    }).length
  }, [customer, customerPriceMap, lines])

  function updateLine(lineId: string, patch: Partial<SaleLineDraft>) {
    setLines((currentLines) =>
      currentLines.map((line) => {
        if (line.id !== lineId) {
          return line
        }

        return { ...line, ...patch }
      }),
    )
  }

  function handleProductChange(lineId: string, productId: string) {
    updateLine(lineId, { product: productId, portion: '' })
  }

  function addLine() {
    setLines((currentLines) => [...currentLines, makeLine()])
  }

  function removeLine(lineId: string) {
    setLines((currentLines) => (currentLines.length === 1 ? currentLines : currentLines.filter((line) => line.id !== lineId)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createWholesaleSale({
        customer,
        notes,
        items: lines.map((line) => ({
          product: line.product,
          portion: line.portion,
          portions_qty: Number(line.portionsQty),
        })),
      })
      setOpen(false)
      setCustomer('')
      setNotes('')
      setLines([makeLine()])
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
        <Button variant="outline" className="w-full gap-1 px-2 text-xs min-[380px]:gap-2 min-[380px]:text-sm sm:w-auto sm:px-4">
          <PackagePlus />
          <span className="min-[360px]:hidden">Mayoreo</span>
          <span className="hidden min-[360px]:inline">Venta mayorista</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[calc(100vw-1rem)] max-w-none overflow-y-auto sm:w-[520px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Registrar venta mayorista</SheetTitle>
          <SheetDescription>
            La entrega se registra ahora y el cobro se captura despues desde el modulo de cobros.
          </SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="wholesale-customer">Cliente mayorista</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger id="wholesale-customer">
                <SelectValue placeholder="Selecciona cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Partidas</p>
                <p className="text-xs text-muted-foreground">Cada partida descuenta inventario con FIFO.</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addLine}>
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>

            {lines.map((line, index) => {
              const selectedProduct = products.find((item) => item.id === line.product)
              const portions = selectedProduct?.portions.filter((item) => item.active) ?? []
              const selectedPortion = portions.find((item) => item.id === line.portion)
              const unitPrice = customerPriceMap.get(`${customer}:${line.product}:${line.portion}`)
              const estimatedGrams =
                selectedProduct && selectedPortion
                  ? Number(line.portionsQty || 0) *
                    selectedPortion.pieces_per_portion *
                    toNumber(selectedProduct.grams_per_piece)
                  : 0

              return (
                <div key={line.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Partida {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {unitPrice ? `Precio activo ${formatMoney(unitPrice.unit_price)}` : 'Sin precio activo detectado'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Eliminar partida</span>
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`wholesale-product-${line.id}`}>Producto</Label>
                      <Select value={line.product} onValueChange={(value) => handleProductChange(line.id, value)}>
                        <SelectTrigger id={`wholesale-product-${line.id}`}>
                          <SelectValue placeholder="Selecciona producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} - {formatGrams(item.available_grams)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-3 min-[420px]:grid-cols-[minmax(0,1fr)_120px]">
                      <div className="grid gap-2">
                        <Label htmlFor={`wholesale-portion-${line.id}`}>Porcion</Label>
                        <Select
                          value={line.portion}
                          onValueChange={(value) => updateLine(line.id, { portion: value })}
                          disabled={!selectedProduct}
                        >
                          <SelectTrigger id={`wholesale-portion-${line.id}`}>
                            <SelectValue placeholder="Selecciona porcion" />
                          </SelectTrigger>
                          <SelectContent>
                            {portions.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} - {item.pieces_per_portion} piezas
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`wholesale-quantity-${line.id}`}>Porciones</Label>
                        <Input
                          id={`wholesale-quantity-${line.id}`}
                          type="number"
                          min="1"
                          step="1"
                          value={line.portionsQty}
                          onChange={(event) => updateLine(line.id, { portionsQty: event.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/35 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Inventario estimado</span>
                        <span className="font-medium">{formatGrams(estimatedGrams)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wholesale-notes">Notas</Label>
            <Textarea
              id="wholesale-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Entrega parcial, observaciones o referencia interna"
            />
          </div>

          <div className="rounded-xl border bg-background/55 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Total estimado</span>
              <span className="font-semibold tabular-nums">{formatMoney(estimatedTotal)}</span>
            </div>
            {linesWithoutPrice > 0 ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Hay {linesWithoutPrice} partida(s) sin precio activo para este cliente.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={
              isSaving ||
              !customer ||
              lines.some((line) => !line.product || !line.portion || Number(line.portionsQty) <= 0)
            }
          >
            {isSaving ? 'Guardando...' : 'Guardar venta mayorista'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { WholesaleSaleAction }
