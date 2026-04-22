import { type FormEvent, useMemo, useState } from 'react'
import { WalletCards } from 'lucide-react'

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
import { createPayment, toNumber, type ApiError, type CustomerBalance } from '@/lib/api'
import { formatMoney } from '@/lib/format'

type PaymentActionProps = {
  customers: CustomerBalance[]
  onCreated: () => Promise<void>
}

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo registrar el cobro.'
}

function PaymentAction({ customers, onCreated }: PaymentActionProps) {
  const [open, setOpen] = useState(false)
  const [customer, setCustomer] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const customersWithBalance = useMemo(
    () => customers.filter((item) => toNumber(item.outstanding_balance) > 0),
    [customers],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createPayment({
        customer,
        amount,
        method,
        reference,
      })
      setOpen(false)
      setAmount('')
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
          <WalletCards />
          <span className="min-[360px]:hidden">Cobro</span>
          <span className="hidden min-[360px]:inline">Registrar cobro</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[calc(100vw-1rem)] max-w-none overflow-y-auto sm:w-[420px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Registrar cobro de cliente</SheetTitle>
          <SheetDescription>El cobro se aplica a las ventas pendientes más antiguas.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="payment-customer">Cliente mayorista</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger id="payment-customer">
                <SelectValue placeholder="Selecciona cliente" />
              </SelectTrigger>
              <SelectContent>
                {customersWithBalance.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} - {formatMoney(item.outstanding_balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payment-amount">Monto cobrado</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>

          <div className="grid gap-3 min-[380px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="payment-method">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="payment-method">
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
              <Label htmlFor="payment-reference">Referencia</Label>
              <Input
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving || customersWithBalance.length === 0 || !customer}>
            {isSaving ? 'Guardando...' : 'Guardar cobro'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { PaymentAction }
