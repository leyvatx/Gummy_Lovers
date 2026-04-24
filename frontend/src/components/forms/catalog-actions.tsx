import * as React from 'react'
import { type FormEvent, useState } from 'react'
import { Plus } from 'lucide-react'

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
  createInventoryLot,
  createPortion,
  createProduct,
  createSupplier,
  type ApiError,
  type Supplier,
} from '@/lib/api'
import { todayInputValue } from '@/lib/format'

type SharedActionProps = {
  onCreated: () => Promise<void>
}

type SupplierActionProps = SharedActionProps

type ProductActionProps = SharedActionProps & {
  suppliers: Supplier[]
}

const sheetClassName =
  'w-full max-w-none overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:max-w-none sm:p-6'

function errorMessage(error: unknown, fallbackMessage: string) {
  return (error as ApiError)?.message ?? fallbackMessage
}

const CreateTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof Button> & { label: string }>(
  ({ label, ...props }, ref) => (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className="size-10 rounded-2xl border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-300/15 dark:bg-pink-400/10 dark:text-pink-100"
      aria-label={label}
      title={label}
      {...props}
    >
      <Plus className="size-4" />
      <span className="sr-only">{label}</span>
    </Button>
  ),
)
CreateTrigger.displayName = 'CreateTrigger'

function SupplierAction({ onCreated }: SupplierActionProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createSupplier({ name, phone, notes })
      setOpen(false)
      setName('')
      setPhone('')
      setNotes('')
      await onCreated()
    } catch (submitError) {
      setError(errorMessage(submitError, 'No se pudo guardar el proveedor.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <CreateTrigger label="Agregar proveedor" />
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Agregar proveedor</SheetTitle>
          <SheetDescription>Guarda el contacto de quien entrega producto.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4 pb-6" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="supplier-name">Nombre</Label>
            <Input id="supplier-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-phone">Teléfono</Label>
            <Input id="supplier-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-notes">Notas</Label>
            <Textarea id="supplier-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar proveedor'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function ProductAction({ suppliers, onCreated }: ProductActionProps) {
  const [open, setOpen] = useState(false)
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [unitCost, setUnitCost] = useState('0')
  const [supplier, setSupplier] = useState('none')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      const product = await createProduct({
        sku,
        name,
        grams_per_piece: '1',
      })

      await createPortion({
        product: product.id,
        name: 'Unidad',
        pieces_per_portion: 1,
      })

      const initialQuantity = Number(quantity)
      if (Number.isFinite(initialQuantity) && initialQuantity > 0) {
        await createInventoryLot({
          product: product.id,
          supplier: supplier === 'none' ? '' : supplier,
          lot_code: `AUTO-${Date.now().toString(36).toUpperCase()}`,
          boxes_qty: Math.trunc(initialQuantity),
          bags_per_box: 1,
          kg_per_bag: '0.001',
          box_cost: unitCost || '0',
          purchased_at: todayInputValue(),
        })
      }

      setOpen(false)
      setSku('')
      setName('')
      setQuantity('0')
      setUnitCost('0')
      setSupplier('none')
      await onCreated()
    } catch (submitError) {
      setError(errorMessage(submitError, 'No se pudo guardar el producto.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <CreateTrigger label="Agregar producto" />
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Agregar producto</SheetTitle>
          <SheetDescription>Registra la gomita y, si aplica, su existencia inicial.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4 pb-6" onSubmit={handleSubmit}>
          <div className="grid gap-3 min-[420px]:grid-cols-[140px_minmax(0,1fr)]">
            <div className="grid gap-2">
              <Label htmlFor="product-sku">SKU</Label>
              <Input id="product-sku" value={sku} onChange={(event) => setSku(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-name">Nombre</Label>
              <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
          </div>

          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="product-quantity">Existencia inicial</Label>
              <Input
                id="product-quantity"
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-cost">Costo por pieza</Label>
              <Input
                id="product-cost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-supplier">Proveedor</Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger id="product-supplier">
                <SelectValue placeholder="Selecciona proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proveedor</SelectItem>
                {suppliers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar producto'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export {
  ProductAction,
  SupplierAction,
}
