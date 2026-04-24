import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { BadgeDollarSign, Eye, Pencil, ReceiptText, Store, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RowContextMenu, type RowContextMenuTarget, useRowContextMenu } from '@/components/ui/row-context-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  toNumber,
  updatePartner,
  type ApiError,
  type Partner,
  type SaleRecord,
  type Supplier,
} from '@/lib/api'
import { formatMoney } from '@/lib/format'

type PartnersWorkspaceProps = {
  partners: Partner[]
  sales: SaleRecord[]
  suppliers: Supplier[]
  onChanged: () => Promise<void>
}

type RowMode = 'details' | 'edit' | null

type PartnerStats = {
  directCount: number
  directRevenue: number
  directUnits: number
  directExtra: number
  wholesaleCount: number
  wholesaleRevenue: number
  wholesaleUnits: number
}

type PartnerRow = {
  partner: Partner
  supplierProfiles: Supplier[]
  stats: PartnerStats
}

const sheetClassName =
  'w-full max-w-none overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[460px] sm:max-w-none sm:p-6'

function errorMessage(error: unknown, fallbackMessage: string) {
  return (error as ApiError)?.message ?? fallbackMessage
}

function unitsLabel(value: number) {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })} pieza${value === 1 ? '' : 's'}`
}

function saleUnits(sale: SaleRecord) {
  return sale.lines.reduce((sum, line) => sum + Number(line.portions_qty || 0), 0)
}

function saleRecoveryAmount(sale: SaleRecord) {
  return sale.lines.reduce((sum, line) => sum + toNumber(line.recovery_amount), 0)
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof ReceiptText
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border bg-background/60 p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-2xl bg-pink-50 text-pink-700 dark:bg-pink-400/10 dark:text-pink-100">
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-3 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function PartnerContextActions({
  row,
  menuTarget,
  onCloseMenu,
  onChanged,
}: {
  row: PartnerRow
  menuTarget: RowContextMenuTarget
  onCloseMenu: () => void
  onChanged: () => Promise<void>
}) {
  const [mode, setMode] = useState<RowMode>(null)
  const [initialCapital, setInitialCapital] = useState(String(row.partner.initial_capital))
  const [ownershipPercent, setOwnershipPercent] = useState(String(row.partner.ownership_percent))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await updatePartner(row.partner.id, {
        initial_capital: initialCapital,
        ownership_percent: ownershipPercent,
      })
      setMode(null)
      await onChanged()
    } catch (editError) {
      setError(errorMessage(editError, 'No se pudo actualizar el socio.'))
    } finally {
      setIsSaving(false)
    }
  }

  function openEdit() {
    setInitialCapital(String(row.partner.initial_capital))
    setOwnershipPercent(String(row.partner.ownership_percent))
    setError('')
    setMode('edit')
  }

  return (
    <>
      <RowContextMenu
        target={menuTarget}
        rowId={row.partner.id}
        onClose={onCloseMenu}
        items={[
          { icon: <Eye className="size-4" />, label: 'Ver detalles', onSelect: () => setMode('details') },
          { icon: <Pencil className="size-4" />, label: 'Editar inversión', onSelect: openEdit },
        ]}
      />

      <Sheet open={mode !== null} onOpenChange={(open) => setMode(open ? mode : null)}>
        <SheetContent className={sheetClassName}>
          {mode === 'details' ? (
            <>
              <SheetHeader>
                <SheetTitle>{row.partner.name}</SheetTitle>
                <SheetDescription>Resumen operativo y financiero del socio.</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-3 text-sm">
                <FieldRow label="Código" value={`Socio ${row.partner.code}`} />
                <FieldRow label="Inversión registrada" value={<span className="font-semibold tabular-nums">{formatMoney(row.partner.initial_capital)}</span>} />
                <FieldRow label="Participación" value={`${toNumber(row.partner.ownership_percent).toFixed(2)}%`} />
                <FieldRow label="Venta propia" value={`${row.stats.directCount} venta${row.stats.directCount === 1 ? '' : 's'} · ${unitsLabel(row.stats.directUnits)}`} />
                <FieldRow label="Venta a proveedores" value={`${row.stats.wholesaleCount} venta${row.stats.wholesaleCount === 1 ? '' : 's'} · ${unitsLabel(row.stats.wholesaleUnits)}`} />
                <FieldRow label="Ganancia / pérdida propia" value={<span className="font-semibold tabular-nums">{formatMoney(row.stats.directExtra)}</span>} />
                <FieldRow label="Proveedor vinculado" value={row.supplierProfiles.map((supplier) => supplier.name).join(', ') || 'Ninguno'} />
              </dl>
            </>
          ) : null}

          {mode === 'edit' ? (
            <>
              <SheetHeader>
                <SheetTitle>Editar inversión</SheetTitle>
                <SheetDescription>Actualiza la inversión registrada y el porcentaje de participación.</SheetDescription>
              </SheetHeader>
              <form className="grid gap-4 pb-6" onSubmit={handleEdit}>
                <div className="rounded-xl border bg-muted/45 p-3 text-sm">
                  <p className="font-medium">{row.partner.name}</p>
                  <p className="text-xs text-muted-foreground">Socio {row.partner.code}</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`partner-capital-${row.partner.id}`}>Inversión registrada</Label>
                  <Input
                    id={`partner-capital-${row.partner.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={initialCapital}
                    onChange={(event) => setInitialCapital(event.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`partner-ownership-${row.partner.id}`}>Participación</Label>
                  <Input
                    id={`partner-ownership-${row.partner.id}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={ownershipPercent}
                    onChange={(event) => setOwnershipPercent(event.target.value)}
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
    </>
  )
}

function PartnersWorkspace({
  partners,
  sales,
  suppliers,
  onChanged,
}: PartnersWorkspaceProps) {
  const partnerContextMenu = useRowContextMenu()

  const rows = useMemo<PartnerRow[]>(() => {
    return partners.map((partner) => {
      const partnerSales = sales.filter((sale) => sale.sold_by_partner === partner.id)
      const directSales = partnerSales.filter((sale) => sale.channel === 'direct')
      const wholesaleSales = partnerSales.filter((sale) => sale.channel === 'wholesale')
      const directRevenue = directSales.reduce((sum, sale) => sum + toNumber(sale.total_amount), 0)
      const directBase = directSales.reduce((sum, sale) => sum + saleRecoveryAmount(sale), 0)
      const wholesaleRevenue = wholesaleSales.reduce((sum, sale) => sum + toNumber(sale.total_amount), 0)

      return {
        partner,
        supplierProfiles: suppliers.filter((supplier) => supplier.partner === partner.id),
        stats: {
          directCount: directSales.length,
          directRevenue,
          directUnits: directSales.reduce((sum, sale) => sum + saleUnits(sale), 0),
          directExtra: directRevenue - directBase,
          wholesaleCount: wholesaleSales.length,
          wholesaleRevenue,
          wholesaleUnits: wholesaleSales.reduce((sum, sale) => sum + saleUnits(sale), 0),
        },
      }
    })
  }, [partners, sales, suppliers])

  const totals = rows.reduce(
    (acc, row) => ({
      capital: acc.capital + toNumber(row.partner.initial_capital),
      directRevenue: acc.directRevenue + row.stats.directRevenue,
      directUnits: acc.directUnits + row.stats.directUnits,
      wholesaleRevenue: acc.wholesaleRevenue + row.stats.wholesaleRevenue,
      wholesaleUnits: acc.wholesaleUnits + row.stats.wholesaleUnits,
    }),
    { capital: 0, directRevenue: 0, directUnits: 0, wholesaleRevenue: 0, wholesaleUnits: 0 },
  )

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={BadgeDollarSign} label="Inversión" value={formatMoney(totals.capital)} helper="Capital registrado por socios" />
        <StatTile icon={ReceiptText} label="Venta propia" value={formatMoney(totals.directRevenue)} helper={unitsLabel(totals.directUnits)} />
        <StatTile icon={Store} label="Venta a proveedores" value={formatMoney(totals.wholesaleRevenue)} helper={unitsLabel(totals.wholesaleUnits)} />
        <StatTile icon={UserRound} label="Socios activos" value={String(partners.length)} helper="Perfiles administrativos" />
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Socios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sin socios registrados.</div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {rows.map((row) => (
                  <article key={row.partner.id} className="rounded-2xl border bg-background/70 p-4 shadow-sm" {...partnerContextMenu.getTargetProps(row.partner.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.partner.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Socio {row.partner.code}</p>
                      </div>
                      <Badge variant="outline" className="border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-400/20 dark:bg-pink-400/10 dark:text-pink-100">
                        {formatMoney(row.partner.initial_capital)}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <FieldRow label="Venta propia" value={`${formatMoney(row.stats.directRevenue)} · ${unitsLabel(row.stats.directUnits)}`} />
                      <FieldRow label="Ganancia / pérdida" value={<span className="font-semibold tabular-nums">{formatMoney(row.stats.directExtra)}</span>} />
                      <FieldRow label="Venta a proveedores" value={`${formatMoney(row.stats.wholesaleRevenue)} · ${unitsLabel(row.stats.wholesaleUnits)}`} />
                    </dl>
                    <PartnerContextActions row={row} menuTarget={partnerContextMenu.target} onCloseMenu={partnerContextMenu.close} onChanged={onChanged} />
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium sm:px-5">Socio</th>
                      <th className="px-4 py-3 font-medium">Inversión</th>
                      <th className="px-4 py-3 font-medium">Venta propia</th>
                      <th className="px-4 py-3 font-medium">Ganancia / pérdida</th>
                      <th className="px-4 py-3 font-medium">Venta a proveedores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.partner.id} className="border-t transition-colors hover:bg-muted/40" {...partnerContextMenu.getTargetProps(row.partner.id)}>
                        <td className="px-4 py-4 font-medium sm:px-5">
                          <div>
                            <p>{row.partner.name}</p>
                            <p className="text-xs text-muted-foreground">Socio {row.partner.code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold tabular-nums">{formatMoney(row.partner.initial_capital)}</td>
                        <td className="px-4 py-4">
                          <div className="font-semibold tabular-nums">{formatMoney(row.stats.directRevenue)}</div>
                          <div className="text-xs text-muted-foreground">{unitsLabel(row.stats.directUnits)}</div>
                        </td>
                        <td className="px-4 py-4 font-semibold tabular-nums">{formatMoney(row.stats.directExtra)}</td>
                        <td className="px-4 py-4">
                          <div className="font-semibold tabular-nums">{formatMoney(row.stats.wholesaleRevenue)}</div>
                          <div className="text-xs text-muted-foreground">{unitsLabel(row.stats.wholesaleUnits)}</div>
                          <PartnerContextActions row={row} menuTarget={partnerContextMenu.target} onCloseMenu={partnerContextMenu.close} onChanged={onChanged} />
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

export { PartnersWorkspace }
