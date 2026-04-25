import { toNumber, type Partner, type SaleLine, type SaleRecord, type Supplier } from '@/lib/api'

const fixedRecoveryByPortionName = new Map([
  ['g1', 15],
  ['chico', 15],
  ['chica', 15],
  ['unidad', 15],
  ['g2', 30],
  ['grande', 30],
])

export type PartnerProfitStats = {
  partner: Partner
  suppliers: Supplier[]
  directSales: number
  supplierSales: number
  directUnits: number
  supplierUnits: number
  directRevenue: number
  supplierRevenue: number
  revenue: number
  recoveryTarget: number
  recoveryCollected: number
  grossProfit: number
  loss: number
  netProfit: number
  paid: number
  receivable: number
  units: number
}

export type ProfitSummary = {
  revenue: number
  recoveryTarget: number
  recoveryCollected: number
  grossProfit: number
  loss: number
  netProfit: number
  paid: number
  receivable: number
  units: number
  partnerRows: PartnerProfitStats[]
  portionRows: PortionProfitStats[]
  unassigned: Omit<PartnerProfitStats, 'partner' | 'suppliers'>
}

export type PortionProfitStats = {
  label: string
  revenue: number
  recoveryTarget: number
  grossProfit: number
  loss: number
  netProfit: number
  units: number
}

function emptyStats(): Omit<PartnerProfitStats, 'partner' | 'suppliers'> {
  return {
    directSales: 0,
    supplierSales: 0,
    directUnits: 0,
    supplierUnits: 0,
    directRevenue: 0,
    supplierRevenue: 0,
    revenue: 0,
    recoveryTarget: 0,
    recoveryCollected: 0,
    grossProfit: 0,
    loss: 0,
    netProfit: 0,
    paid: 0,
    receivable: 0,
    units: 0,
  }
}

export function saleUnits(sale: SaleRecord) {
  return sale.lines.reduce((sum, line) => sum + Number(line.portions_qty || 0), 0)
}

function normalizedPortionName(value: string) {
  return value.trim().toLowerCase().replaceAll(' ', '').replaceAll('-', '')
}

function fixedRecoveryForLine(line: SaleLine) {
  return fixedRecoveryByPortionName.get(normalizedPortionName(line.portion_name)) ?? 0
}

export function lineRecoveryAmount(line: SaleLine) {
  const quantity = Number(line.portions_qty || 0)
  const storedRecovery = toNumber(line.recovery_amount)
  if (storedRecovery > 0) {
    return storedRecovery
  }

  const snapshotRecovery = toNumber(line.recovery_unit_price_snapshot)
  if (snapshotRecovery > 0) {
    return snapshotRecovery * quantity
  }

  return fixedRecoveryForLine(line) * quantity
}

export function saleRecoveryAmount(sale: SaleRecord) {
  return sale.lines.reduce((sum, line) => sum + lineRecoveryAmount(line), 0)
}

export function saleProfitAmount(sale: SaleRecord) {
  return toNumber(sale.total_amount) - saleRecoveryAmount(sale)
}

export function saleOwnerPartnerId(sale: SaleRecord, suppliers: Supplier[]) {
  if (sale.channel === 'wholesale' && sale.supplier) {
    const supplier = suppliers.find((item) => item.id === sale.supplier)
    if (supplier?.partner) {
      return supplier.partner
    }
  }

  return sale.sold_by_partner
}

function applySale(stats: Omit<PartnerProfitStats, 'partner' | 'suppliers'>, sale: SaleRecord) {
  const revenue = toNumber(sale.total_amount)
  const paid = toNumber(sale.paid_amount)
  const receivable = toNumber(sale.outstanding_balance)
  const recoveryTarget = saleRecoveryAmount(sale)
  const margin = revenue - recoveryTarget
  const units = saleUnits(sale)

  stats.revenue += revenue
  stats.recoveryTarget += recoveryTarget
  stats.recoveryCollected += Math.min(paid, recoveryTarget)
  stats.grossProfit += Math.max(0, margin)
  stats.loss += Math.max(0, -margin)
  stats.netProfit += margin
  stats.paid += paid
  stats.receivable += receivable
  stats.units += units

  if (sale.channel === 'direct') {
    stats.directSales += 1
    stats.directUnits += units
    stats.directRevenue += revenue
  } else {
    stats.supplierSales += 1
    stats.supplierUnits += units
    stats.supplierRevenue += revenue
  }
}

export function buildProfitSummary(partners: Partner[], suppliers: Supplier[], sales: SaleRecord[]): ProfitSummary {
  const partnerRows = partners.map((partner) => ({
    partner,
    suppliers: suppliers.filter((supplier) => supplier.partner === partner.id),
    ...emptyStats(),
  }))
  const rowsByPartner = new Map(partnerRows.map((row) => [row.partner.id, row]))
  const unassigned = emptyStats()
  const portionRowsByLabel = new Map<string, PortionProfitStats>()

  function portionLabel(line: SaleLine) {
    const normalizedName = normalizedPortionName(line.portion_name)
    if (['g1', 'chico', 'chica', 'unidad'].includes(normalizedName)) {
      return 'G1'
    }
    if (['g2', 'grande'].includes(normalizedName)) {
      return 'G2'
    }
    return line.portion_name || 'Sin tipo'
  }

  function applyLine(line: SaleLine) {
    const label = portionLabel(line)
    const existing = portionRowsByLabel.get(label) ?? {
      label,
      revenue: 0,
      recoveryTarget: 0,
      grossProfit: 0,
      loss: 0,
      netProfit: 0,
      units: 0,
    }
    const revenue = toNumber(line.line_total)
    const recoveryTarget = lineRecoveryAmount(line)
    const netProfit = revenue - recoveryTarget

    existing.revenue += revenue
    existing.recoveryTarget += recoveryTarget
    existing.grossProfit += Math.max(0, netProfit)
    existing.loss += Math.max(0, -netProfit)
    existing.netProfit += netProfit
    existing.units += Number(line.portions_qty || 0)
    portionRowsByLabel.set(label, existing)
  }

  sales
    .filter((sale) => sale.status !== 'cancelled')
    .forEach((sale) => {
      sale.lines.forEach(applyLine)

      const ownerId = saleOwnerPartnerId(sale, suppliers)
      const row = ownerId ? rowsByPartner.get(ownerId) : null

      if (row) {
        applySale(row, sale)
        return
      }

      applySale(unassigned, sale)
    })

  const totals = [...partnerRows, unassigned].reduce(
    (acc, row) => {
      acc.revenue += row.revenue
      acc.recoveryTarget += row.recoveryTarget
      acc.recoveryCollected += row.recoveryCollected
      acc.grossProfit += row.grossProfit
      acc.loss += row.loss
      acc.netProfit += row.netProfit
      acc.paid += row.paid
      acc.receivable += row.receivable
      acc.units += row.units
      return acc
    },
    {
      revenue: 0,
      recoveryTarget: 0,
      recoveryCollected: 0,
      grossProfit: 0,
      loss: 0,
      netProfit: 0,
      paid: 0,
      receivable: 0,
      units: 0,
    },
  )

  return {
    ...totals,
    partnerRows,
    portionRows: Array.from(portionRowsByLabel.values()).sort((left, right) => {
      const order = ['G1', 'G2']
      return (order.indexOf(left.label) === -1 ? 99 : order.indexOf(left.label))
        - (order.indexOf(right.label) === -1 ? 99 : order.indexOf(right.label))
    }),
    unassigned,
  }
}
