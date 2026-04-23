import { type FormEvent, useMemo, useState } from 'react'
import { Boxes, Package2, Tags, Truck, UserRoundPlus, Wallet2 } from 'lucide-react'

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
  createCustomer,
  createCustomerPrice,
  createInventoryLot,
  createPortion,
  createProduct,
  createSupplier,
  type ApiError,
  type AuthUser,
  type Customer,
  type Product,
  type Supplier,
} from '@/lib/api'
import { todayInputValue } from '@/lib/format'

type SharedActionProps = {
  onCreated: () => Promise<void>
}

type SupplierActionProps = SharedActionProps

type ProductActionProps = SharedActionProps

type PortionActionProps = SharedActionProps & {
  products: Product[]
}

type CustomerActionProps = SharedActionProps

type CustomerPriceActionProps = SharedActionProps & {
  customers: Customer[]
  products: Product[]
}

type InventoryLotActionProps = SharedActionProps & {
  products: Product[]
  suppliers: Supplier[]
  user: AuthUser
}

const sheetClassName = 'w-[calc(100vw-1rem)] max-w-none overflow-y-auto sm:w-[420px] sm:max-w-none'

function errorMessage(error: unknown, fallbackMessage: string) {
  return (error as ApiError)?.message ?? fallbackMessage
}

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
        <Button variant="outline" className="gap-2">
          <Truck className="size-4" />
          Proveedor
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar proveedor</SheetTitle>
          <SheetDescription>Alta de proveedor para compras de inventario.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="supplier-name">Nombre</Label>
            <Input id="supplier-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-phone">Telefono</Label>
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

function ProductAction({ onCreated }: ProductActionProps) {
  const [open, setOpen] = useState(false)
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [gramsPerPiece, setGramsPerPiece] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createProduct({
        sku,
        name,
        grams_per_piece: gramsPerPiece,
      })
      setOpen(false)
      setSku('')
      setName('')
      setGramsPerPiece('')
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
        <Button variant="outline" className="gap-2">
          <Package2 className="size-4" />
          Producto
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar producto</SheetTitle>
          <SheetDescription>Producto maestro con conversion de piezas a gramos.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
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

          <div className="grid gap-2">
            <Label htmlFor="product-grams">Gramos por pieza</Label>
            <Input
              id="product-grams"
              type="number"
              min="0.0001"
              step="0.0001"
              value={gramsPerPiece}
              onChange={(event) => setGramsPerPiece(event.target.value)}
              required
            />
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

function PortionAction({ products, onCreated }: PortionActionProps) {
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState('')
  const [name, setName] = useState('')
  const [piecesPerPortion, setPiecesPerPortion] = useState('6')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createPortion({
        product,
        name,
        pieces_per_portion: Number(piecesPerPortion),
      })
      setOpen(false)
      setProduct('')
      setName('')
      setPiecesPerPortion('6')
      await onCreated()
    } catch (submitError) {
      setError(errorMessage(submitError, 'No se pudo guardar la porcion.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tags className="size-4" />
          Porcion
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar porcion</SheetTitle>
          <SheetDescription>Tamano operativo para venta propia o mayoreo.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="portion-product">Producto</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger id="portion-product">
                <SelectValue placeholder="Selecciona producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.sku} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 min-[420px]:grid-cols-[minmax(0,1fr)_140px]">
            <div className="grid gap-2">
              <Label htmlFor="portion-name">Nombre</Label>
              <Input id="portion-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portion-pieces">Piezas</Label>
              <Input
                id="portion-pieces"
                type="number"
                min="1"
                step="1"
                value={piecesPerPortion}
                onChange={(event) => setPiecesPerPortion(event.target.value)}
                required
              />
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving || products.length === 0}>
            {isSaving ? 'Guardando...' : 'Guardar porcion'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function CustomerAction({ onCreated }: CustomerActionProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [creditLimit, setCreditLimit] = useState('0')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createCustomer({
        name,
        contact_name: contactName,
        phone,
        address,
        credit_limit: creditLimit,
      })
      setOpen(false)
      setName('')
      setContactName('')
      setPhone('')
      setAddress('')
      setCreditLimit('0')
      await onCreated()
    } catch (submitError) {
      setError(errorMessage(submitError, 'No se pudo guardar el cliente.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserRoundPlus className="size-4" />
          Cliente
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar cliente mayorista</SheetTitle>
          <SheetDescription>Cliente con saldo y limite de credito.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="customer-name">Nombre comercial</Label>
            <Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>

          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-contact">Contacto</Label>
              <Input id="customer-contact" value={contactName} onChange={(event) => setContactName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-phone">Telefono</Label>
              <Input id="customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customer-address">Direccion</Label>
            <Textarea id="customer-address" value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customer-limit">Limite de credito</Label>
            <Input
              id="customer-limit"
              type="number"
              min="0"
              step="0.01"
              value={creditLimit}
              onChange={(event) => setCreditLimit(event.target.value)}
              required
            />
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar cliente'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function CustomerPriceAction({ customers, products, onCreated }: CustomerPriceActionProps) {
  const [open, setOpen] = useState(false)
  const [customer, setCustomer] = useState('')
  const [product, setProduct] = useState('')
  const [portion, setPortion] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === product),
    [product, products],
  )
  const availablePortions = useMemo(
    () => selectedProduct?.portions.filter((item) => item.active) ?? [],
    [selectedProduct],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createCustomerPrice({
        customer,
        product,
        portion,
        unit_price: unitPrice,
      })
      setOpen(false)
      setCustomer('')
      setProduct('')
      setPortion('')
      setUnitPrice('')
      await onCreated()
    } catch (submitError) {
      setError(errorMessage(submitError, 'No se pudo guardar el precio.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet2 className="size-4" />
          Precio
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar precio mayorista</SheetTitle>
          <SheetDescription>Precio activo por cliente, producto y porcion.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="price-customer">Cliente</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger id="price-customer">
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

          <div className="grid gap-2">
            <Label htmlFor="price-product">Producto</Label>
            <Select
              value={product}
              onValueChange={(value) => {
                setProduct(value)
                setPortion('')
              }}
            >
              <SelectTrigger id="price-product">
                <SelectValue placeholder="Selecciona producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.sku} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 min-[420px]:grid-cols-[minmax(0,1fr)_140px]">
            <div className="grid gap-2">
              <Label htmlFor="price-portion">Porcion</Label>
              <Select value={portion} onValueChange={setPortion} disabled={!selectedProduct}>
                <SelectTrigger id="price-portion">
                  <SelectValue placeholder="Selecciona porcion" />
                </SelectTrigger>
                <SelectContent>
                  {availablePortions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} - {item.pieces_per_portion} piezas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price-amount">Precio</Label>
              <Input
                id="price-amount"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                required
              />
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving || customers.length === 0 || products.length === 0}>
            {isSaving ? 'Guardando...' : 'Guardar precio'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function InventoryLotAction({ products, suppliers, user, onCreated }: InventoryLotActionProps) {
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState('')
  const [supplier, setSupplier] = useState('none')
  const [lotCode, setLotCode] = useState('')
  const [boxesQty, setBoxesQty] = useState('1')
  const [bagsPerBox, setBagsPerBox] = useState('1')
  const [kgPerBag, setKgPerBag] = useState('1.000')
  const [boxCost, setBoxCost] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(todayInputValue())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createInventoryLot({
        product,
        supplier: supplier === 'none' ? '' : supplier,
        lot_code: lotCode,
        boxes_qty: Number(boxesQty),
        bags_per_box: Number(bagsPerBox),
        kg_per_bag: kgPerBag,
        box_cost: boxCost,
        purchased_at: purchasedAt,
      })
      setOpen(false)
      setProduct('')
      setSupplier('none')
      setLotCode('')
      setBoxesQty('1')
      setBagsPerBox('1')
      setKgPerBag('1.000')
      setBoxCost('')
      setPurchasedAt(todayInputValue())
      await onCreated()
    } catch (submitError) {
      setError(errorMessage(submitError, 'No se pudo guardar el lote.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Boxes className="size-4" />
          Lote
        </Button>
      </SheetTrigger>
      <SheetContent className={sheetClassName}>
        <SheetHeader>
          <SheetTitle>Registrar lote de inventario</SheetTitle>
          <SheetDescription>El pago del lote se vincula automaticamente a tu sesion.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="rounded-xl border bg-muted/45 p-3 text-sm">
            <p className="font-medium">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">Socio pagador desde sesion activa</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lot-product">Producto</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger id="lot-product">
                <SelectValue placeholder="Selecciona producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.sku} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lot-supplier">Proveedor</Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger id="lot-supplier">
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

          <div className="grid gap-3 min-[420px]:grid-cols-[minmax(0,1fr)_140px]">
            <div className="grid gap-2">
              <Label htmlFor="lot-code">Codigo de lote</Label>
              <Input id="lot-code" value={lotCode} onChange={(event) => setLotCode(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lot-date">Fecha</Label>
              <Input id="lot-date" type="date" value={purchasedAt} onChange={(event) => setPurchasedAt(event.target.value)} required />
            </div>
          </div>

          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lot-boxes">Cajas</Label>
              <Input
                id="lot-boxes"
                type="number"
                min="1"
                step="1"
                value={boxesQty}
                onChange={(event) => setBoxesQty(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lot-bags">Bolsas por caja</Label>
              <Input
                id="lot-bags"
                type="number"
                min="1"
                step="1"
                value={bagsPerBox}
                onChange={(event) => setBagsPerBox(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 min-[420px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lot-kg">Kg por bolsa</Label>
              <Input
                id="lot-kg"
                type="number"
                min="0.001"
                step="0.001"
                value={kgPerBag}
                onChange={(event) => setKgPerBag(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lot-cost">Costo por caja</Label>
              <Input
                id="lot-cost"
                type="number"
                min="0"
                step="0.01"
                value={boxCost}
                onChange={(event) => setBoxCost(event.target.value)}
                required
              />
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving || products.length === 0}>
            {isSaving ? 'Guardando...' : 'Guardar lote'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export {
  CustomerAction,
  CustomerPriceAction,
  InventoryLotAction,
  PortionAction,
  ProductAction,
  SupplierAction,
}
