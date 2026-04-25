import { BadgeDollarSign, Scale, Store, TrendingDown, WalletCards } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Partner, SaleRecord, Supplier } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { buildProfitSummary, type PartnerProfitStats } from '@/lib/profit-stats'
import { cn } from '@/lib/utils'

type ProfitWorkspaceProps = {
  partners: Partner[]
  sales: SaleRecord[]
  suppliers: Supplier[]
}

type StatCardProps = {
  title: string
  value: string
  helper: string
  icon: typeof BadgeDollarSign
  tone: 'pink' | 'green' | 'red' | 'purple'
}

const toneClasses = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100',
  pink: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-400/20 dark:bg-pink-400/10 dark:text-pink-100',
  purple: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-100',
  red: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100',
}

function unitsLabel(value: number) {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })} pieza${value === 1 ? '' : 's'}`
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return '0%'
  }

  return `${((value / total) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`
}

function StatCard({ title, value, helper, icon: Icon, tone }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
        <div className={cn('rounded-lg border p-2', toneClasses[tone])}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="break-words text-xl font-semibold leading-tight tabular-nums min-[380px]:text-2xl sm:text-3xl">
          {value}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function ChartBar({
  label,
  value,
  max,
  tone,
}: {
  label: string
  value: number
  max: number
  tone: 'pink' | 'green' | 'red' | 'purple'
}) {
  const width = max > 0 ? Math.max(4, Math.min(100, (Math.abs(value) / max) * 100)) : 0

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-semibold tabular-nums', value < 0 && 'text-rose-600 dark:text-rose-300')}>
          {formatMoney(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', toneClasses[tone])} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function PartnerComparisonChart({ rows }: { rows: PartnerProfitStats[] }) {
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.revenue, row.recoveryTarget, Math.abs(row.netProfit)]),
  )

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Comparativo por socio</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 pt-5">
        {rows.map((row) => (
          <div key={row.partner.id} className="grid gap-3 rounded-2xl border bg-background/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{row.partner.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.suppliers.length} proveedor{row.suppliers.length === 1 ? '' : 'es'} vinculado{row.suppliers.length === 1 ? '' : 's'}
                </p>
              </div>
              <Badge variant="outline" className={row.netProfit < 0 ? toneClasses.red : toneClasses.green}>
                {formatMoney(row.netProfit)}
              </Badge>
            </div>
            <ChartBar label="Venta total" value={row.revenue} max={maxValue} tone="pink" />
            <ChartBar label="Recuperado fijo" value={row.recoveryTarget} max={maxValue} tone="purple" />
            <ChartBar label="Ganancia / pérdida" value={row.netProfit} max={maxValue} tone={row.netProfit < 0 ? 'red' : 'green'} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ChannelComparison({ rows }: { rows: PartnerProfitStats[] }) {
  const maxRevenue = Math.max(1, ...rows.flatMap((row) => [row.directRevenue, row.supplierRevenue]))

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Venta propia contra proveedores</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 pt-5">
        {rows.map((row) => (
          <div key={row.partner.id} className="grid gap-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{row.partner.name}</span>
              <span className="text-muted-foreground">{unitsLabel(row.units)}</span>
            </div>
            <ChartBar label="Venta propia" value={row.directRevenue} max={maxRevenue} tone="pink" />
            <ChartBar label="Venta a proveedores" value={row.supplierRevenue} max={maxRevenue} tone="purple" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PartnerProfitTable({ rows }: { rows: PartnerProfitStats[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Detalle por socio</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-3 p-4 md:hidden">
          {rows.map((row) => (
            <article key={row.partner.id} className="rounded-2xl border bg-background/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.partner.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.suppliers.length} proveedores</p>
                </div>
                <Badge variant="outline" className={row.netProfit < 0 ? toneClasses.red : toneClasses.green}>
                  {formatMoney(row.netProfit)}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Recuperado fijo</dt>
                  <dd className="font-medium tabular-nums">{formatMoney(row.recoveryTarget)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Ganancia</dt>
                  <dd className="font-medium tabular-nums">{formatMoney(row.grossProfit)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Pérdida</dt>
                  <dd className="font-medium tabular-nums text-rose-600 dark:text-rose-300">{formatMoney(row.loss)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Pendiente</dt>
                  <dd className="font-medium tabular-nums">{formatMoney(row.receivable)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-5">Socio</th>
                <th className="px-4 py-3 font-medium">Proveedores</th>
                <th className="px-4 py-3 font-medium">Venta propia</th>
                <th className="px-4 py-3 font-medium">Venta a proveedores</th>
                <th className="px-4 py-3 font-medium">Recuperado fijo</th>
                <th className="px-4 py-3 font-medium">Ganancia</th>
                <th className="px-4 py-3 font-medium">Pérdida</th>
                <th className="px-4 py-3 font-medium">Neto</th>
                <th className="px-4 py-3 font-medium">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.partner.id} className="border-t transition-colors hover:bg-muted/40">
                  <td className="px-4 py-4 font-medium sm:px-5">
                    <div>
                      <p>{row.partner.name}</p>
                      <p className="text-xs text-muted-foreground">Socio {row.partner.code}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{row.suppliers.length}</td>
                  <td className="px-4 py-4">
                    <div className="font-semibold tabular-nums">{formatMoney(row.directRevenue)}</div>
                    <div className="text-xs text-muted-foreground">{row.directSales} ventas</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold tabular-nums">{formatMoney(row.supplierRevenue)}</div>
                    <div className="text-xs text-muted-foreground">{row.supplierSales} ventas</div>
                  </td>
                  <td className="px-4 py-4 font-semibold tabular-nums">{formatMoney(row.recoveryTarget)}</td>
                  <td className="px-4 py-4 font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">{formatMoney(row.grossProfit)}</td>
                  <td className="px-4 py-4 font-semibold tabular-nums text-rose-600 dark:text-rose-300">{formatMoney(row.loss)}</td>
                  <td className={cn('px-4 py-4 font-semibold tabular-nums', row.netProfit < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300')}>
                    {formatMoney(row.netProfit)}
                  </td>
                  <td className="px-4 py-4 font-semibold tabular-nums">{formatMoney(row.receivable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function ProfitWorkspace({ partners, sales, suppliers }: ProfitWorkspaceProps) {
  const summary = buildProfitSummary(partners, suppliers, sales)
  const margin = percent(summary.netProfit, summary.revenue)

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Ganancia neta"
          value={formatMoney(summary.netProfit)}
          helper={`Margen ${margin}, después de recuperar G1/G2`}
          icon={BadgeDollarSign}
          tone={summary.netProfit < 0 ? 'red' : 'green'}
        />
        <StatCard
          title="Recuperado fijo"
          value={formatMoney(summary.recoveryTarget)}
          helper={`${formatMoney(summary.recoveryCollected)} ya cobrado como recuperación`}
          icon={Scale}
          tone="purple"
        />
        <StatCard
          title="Ganancias"
          value={formatMoney(summary.grossProfit)}
          helper="Importe arriba de $15 en G1 y $30 en G2"
          icon={WalletCards}
          tone="pink"
        />
        <StatCard
          title="Pérdidas"
          value={formatMoney(summary.loss)}
          helper="Ventas debajo del recuperado fijo"
          icon={TrendingDown}
          tone="red"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <PartnerComparisonChart rows={summary.partnerRows} />
        <ChannelComparison rows={summary.partnerRows} />
      </section>

      {summary.unassigned.revenue > 0 ? (
        <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-400/20 dark:bg-rose-400/10">
          <CardContent className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Store className="size-4 text-rose-600 dark:text-rose-300" />
              <span>Hay ventas sin socio asignado. Revisa proveedores sin socio o ventas antiguas.</span>
            </div>
            <strong className="tabular-nums">{formatMoney(summary.unassigned.revenue)}</strong>
          </CardContent>
        </Card>
      ) : null}

      <PartnerProfitTable rows={summary.partnerRows} />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Lectura rápida</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border bg-background/55 p-4">
            <p className="text-muted-foreground">Venta total</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{formatMoney(summary.revenue)}</p>
          </div>
          <div className="rounded-2xl border bg-background/55 p-4">
            <p className="text-muted-foreground">Cobrado</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{formatMoney(summary.paid)}</p>
          </div>
          <div className="rounded-2xl border bg-background/55 p-4">
            <p className="text-muted-foreground">Por cobrar</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{formatMoney(summary.receivable)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { ProfitWorkspace }
