import { type FormEvent, useMemo, useState } from 'react'
import { Eye, Pencil, ReceiptText, Trash2 } from 'lucide-react'

import type { SaleChannelFilter, SaleStatusFilter } from '@/components/sales/sales-filters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RowContextMenu, type RowContextMenuTarget, useRowContextMenu } from '@/components/ui/row-context-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { deleteSale, toNumber, updateSale, type ApiError, type SaleRecord, type SaleStatus } from '@/lib/api'
import { formatMoney } from '@/lib/format'

type SalesWorkspaceProps = {
  sales: SaleRecord[]
  query: string
  status: SaleStatusFilter
  channel: SaleChannelFilter
  onChanged: () => Promise<void>
}

type RowMode = 'details' | 'edit' | null

const sheetClassName =
  'w-full max-w-none overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[460px] sm:max-w-none sm:p-6'

const statusLabels: Record<SaleStatus, string> = {
  cancelled: 'Cancelada',
  delivered: 'Pendiente',
  draft: 'Borrador',
  paid: 'Pagada',
  partial: 'Parcial',
}

const statusClasses: Record<SaleStatus, string> = {
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100',
  delivered: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-100',
  draft: 'border-muted bg-muted text-muted-foreground',
  paid: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-400/20 dark:bg-pink-400/10 dark:text-pink-100',
  partial: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-100',
}

function errorMessage(error: unknown, fallbackMessage: string) {
  return (error as ApiError)?.message ?? fallbackMessage
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin fecha'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function channelLabel(sale: SaleRecord) {
  return sale.channel === 'direct' ? 'Venta propia' : 'Venta a proveedores'
}

function salePartyLabel(sale: SaleRecord) {
  if (sale.channel === 'wholesale') {
    return sale.supplier_name || sale.customer_name || 'Sin proveedor'
  }

  return sale.sold_by_partner_name || sale.customer_name || 'Sin registro'
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function saleProductLabel(sale: SaleRecord) {
  if (sale.lines.length === 0) {
    return 'Sin productos'
  }

  return sale.lines.map((line) => `${line.product_sku} ${line.portion_name} x${line.portions_qty}`).join(', ')
}

function saleRecoveryAmount(sale: SaleRecord) {
  return sale.lines.reduce((sum, line) => sum + toNumber(line.recovery_amount), 0)
}

function saleMargin(sale: SaleRecord) {
  return toNumber(sale.total_amount) - saleRecoveryAmount(sale)
}

function matchesSaleQuery(sale: SaleRecord, query: string) {
  if (!query) {
    return true
  }

  return [
    sale.customer_name,
    sale.supplier_name,
    sale.sold_by_partner_name,
    sale.status,
    sale.notes,
    channelLabel(sale),
    ...sale.lines.flatMap((line) => [line.product_sku, line.portion_name, line.portions_qty]),
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function SaleContextActions({
  sale,
  menuTarget,
  onCloseMenu,
  onChanged,
}: {
  sale: SaleRecord
  menuTarget: RowContextMenuTarget
  onCloseMenu: () => void
  onChanged: () => Promise<void>
}) {
  const [mode, setMode] = useState<RowMode>(null)
  const [notes, setNotes] = useState(sale.notes)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await updateSale(sale.id, { notes })
      setMode(null)
      await onChanged()
    } catch (editError) {
      setError(errorMessage(editError, 'No se pudo actualizar la venta.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta venta?')) {
      return
    }

    try {
      await deleteSale(sale.id)
      await onChanged()
    } catch (deleteError) {
      window.alert(errorMessage(deleteError, 'No se pudo eliminar la venta.'))
    }
  }

  function openEdit() {
    setNotes(sale.notes)
    setError('')
    setMode('edit')
  }

  return (
    <>
      <RowContextMenu
        target={menuTarget}
        rowId={sale.id}
        onClose={onCloseMenu}
        items={[
          { icon: <Eye className="size-4" />, label: 'Ver detalles', onSelect: () => setMode('details') },
          { icon: <Pencil className="size-4" />, label: 'Editar', onSelect: openEdit },
          { destructive: true, icon: <Trash2 className="size-4" />, label: 'Eliminar', onSelect: () => void handleDelete() },
        ]}
      />

      <Sheet open={mode !== null} onOpenChange={(open) => setMode(open ? mode : null)}>
        <SheetContent className={sheetClassName}>
          {mode === 'details' ? (
            <>
              <SheetHeader>
                <SheetTitle>Venta</SheetTitle>
                <SheetDescription>{formatDate(sale.delivered_at)}</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-3 text-sm">
                <FieldRow label="Canal" value={channelLabel(sale)} />
                <FieldRow
                  label="Estado"
                  value={
                    <Badge variant="outline" className={statusClasses[sale.status]}>
                      {statusLabels[sale.status]}
                    </Badge>
                  }
                />
                <FieldRow label="Vendedor" value={sale.sold_by_partner_name || 'Sin vendedor'} />
                <FieldRow label="Registro" value={salePartyLabel(sale)} />
                <FieldRow label="Productos" value={saleProductLabel(sale)} />
                <FieldRow label="Recuperado fijo" value={<span className="tabular-nums">{formatMoney(saleRecoveryAmount(sale))}</span>} />
                <FieldRow label="Ganancia / pérdida" value={<span className="font-semibold tabular-nums">{formatMoney(saleMargin(sale))}</span>} />
                <FieldRow label="Total" value={<span className="font-semibold tabular-nums">{formatMoney(sale.total_amount)}</span>} />
                <FieldRow label="Pagado" value={<span className="tabular-nums">{formatMoney(sale.paid_amount)}</span>} />
                <FieldRow label="Pendiente" value={<span className="tabular-nums">{formatMoney(sale.outstanding_balance)}</span>} />
                <FieldRow label="Notas" value={sale.notes || 'Sin notas'} />
              </dl>
            </>
          ) : null}

          {mode === 'edit' ? (
            <>
              <SheetHeader>
                <SheetTitle>Editar venta</SheetTitle>
                <SheetDescription>Actualiza notas sin alterar inventario ni pagos.</SheetDescription>
              </SheetHeader>
              <form className="grid gap-4 pb-6" onSubmit={handleEdit}>
                <div className="grid gap-2">
                  <Label htmlFor={`sale-notes-${sale.id}`}>Notas</Label>
                  <Textarea id={`sale-notes-${sale.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} />
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
    </>
  )
}

function SalesWorkspace({ sales, query, status, channel, onChanged }: SalesWorkspaceProps) {
  const saleContextMenu = useRowContextMenu()
  const filteredSales = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)

    return sales
      .filter((sale) => status === 'all' || sale.status === status)
      .filter((sale) => channel === 'all' || sale.channel === channel)
      .filter((sale) => matchesSaleQuery(sale, normalizedQuery))
  }, [channel, query, sales, status])

  const totalAmount = filteredSales.reduce((sum, sale) => sum + toNumber(sale.total_amount), 0)

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-2xl border bg-card/80 p-3 shadow-[var(--ui-shadow-soft)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl border bg-pink-50 text-pink-700 dark:bg-pink-400/10 dark:text-pink-200">
            <ReceiptText className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">{filteredSales.length} venta{filteredSales.length === 1 ? '' : 's'}</p>
            <p className="text-sm text-muted-foreground">Total filtrado: {formatMoney(totalAmount)}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Ventas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSales.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No hay ventas para mostrar con estos filtros.</div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {filteredSales.map((sale) => (
                  <article key={sale.id} className="rounded-2xl border bg-background/70 p-4 shadow-sm" {...saleContextMenu.getTargetProps(sale.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{channelLabel(sale)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDate(sale.delivered_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Badge variant="outline" className={statusClasses[sale.status]}>
                          {statusLabels[sale.status]}
                        </Badge>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <FieldRow label="Vendedor" value={sale.sold_by_partner_name || 'Sin vendedor'} />
                      <FieldRow label="Registro" value={salePartyLabel(sale)} />
                      <FieldRow label="Productos" value={saleProductLabel(sale)} />
                      <FieldRow label="Total" value={<span className="font-semibold tabular-nums">{formatMoney(sale.total_amount)}</span>} />
                    </dl>
                    <SaleContextActions
                      sale={sale}
                      menuTarget={saleContextMenu.target}
                      onCloseMenu={saleContextMenu.close}
                      onChanged={onChanged}
                    />
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Fecha</th>
                      <th className="px-4 py-3 font-medium">Canal</th>
                      <th className="px-4 py-3 font-medium">Vendedor</th>
                      <th className="px-4 py-3 font-medium">Registro</th>
                      <th className="px-4 py-3 font-medium">Productos</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="border-t transition-colors hover:bg-muted/40" {...saleContextMenu.getTargetProps(sale.id)}>
                        <td className="px-4 py-4 text-muted-foreground sm:px-5">{formatDate(sale.delivered_at)}</td>
                        <td className="px-4 py-4 font-medium">{channelLabel(sale)}</td>
                        <td className="px-4 py-4 text-muted-foreground">{sale.sold_by_partner_name || 'Sin vendedor'}</td>
                        <td className="px-4 py-4 text-muted-foreground">{salePartyLabel(sale)}</td>
                        <td className="px-4 py-4 text-muted-foreground">{saleProductLabel(sale)}</td>
                        <td className="px-4 py-4 font-semibold tabular-nums">{formatMoney(sale.total_amount)}</td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className={statusClasses[sale.status]}>
                            {statusLabels[sale.status]}
                          </Badge>
                          <SaleContextActions
                            sale={sale}
                            menuTarget={saleContextMenu.target}
                            onCloseMenu={saleContextMenu.close}
                            onChanged={onChanged}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { SalesWorkspace }
