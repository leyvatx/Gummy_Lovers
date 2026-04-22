import { type FormEvent, useState } from 'react'
import { ReceiptText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { createExpense, type ApiError, type AuthUser } from '@/lib/api'
import { todayInputValue } from '@/lib/format'

type ExpenseActionProps = {
  user: AuthUser
  onCreated: () => Promise<void>
}

function errorMessage(error: unknown) {
  return (error as ApiError)?.message ?? 'No se pudo guardar el gasto.'
}

function ExpenseAction({ user, onCreated }: ExpenseActionProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('Insumos')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [incurredAt, setIncurredAt] = useState(todayInputValue())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createExpense({
        category,
        description,
        amount,
        incurred_at: incurredAt,
      })
      setOpen(false)
      setDescription('')
      setAmount('')
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
          <ReceiptText />
          <span className="min-[360px]:hidden">Gasto</span>
          <span className="hidden min-[360px]:inline">Gasto rápido</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[calc(100vw-1rem)] max-w-none overflow-y-auto sm:w-[420px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Registrar gasto operativo</SheetTitle>
          <SheetDescription>El gasto se registra automáticamente a nombre de tu sesión.</SheetDescription>
        </SheetHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="rounded-xl border bg-muted/45 p-3 text-sm">
            <p className="font-medium">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">Socio registrado desde sesión activa</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expense-category">Categoría</Label>
            <Input
              id="expense-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expense-description">Descripción</Label>
            <Textarea
              id="expense-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Empaques, salsas, etiquetas"
              required
            />
          </div>

          <div className="grid gap-3 min-[380px]:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">Monto</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input
                id="expense-date"
                type="date"
                value={incurredAt}
                onChange={(event) => setIncurredAt(event.target.value)}
                required
              />
            </div>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar gasto'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { ExpenseAction }
