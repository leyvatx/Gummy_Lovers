import { toNumber, type PortionSize, type Product } from '@/lib/api'
import { formatMoney } from '@/lib/format'

const fixedNames = new Map([
  ['g1', 15],
  ['chico', 15],
  ['chica', 15],
  ['unidad', 15],
  ['g2', 30],
  ['grande', 30],
])

function normalizeName(value: string) {
  return value.trim().toLowerCase().replaceAll(' ', '').replaceAll('-', '')
}

export function recoveryPriceForPortion(portion: PortionSize | null | undefined) {
  if (!portion) {
    return 0
  }

  const configuredPrice = toNumber(portion.recovery_price)
  if (configuredPrice > 0) {
    return configuredPrice
  }

  return fixedNames.get(normalizeName(portion.name)) ?? 0
}

export function salePortions(product: Product | null | undefined) {
  if (!product) {
    return []
  }

  return product.portions
    .filter((portion) => portion.active && recoveryPriceForPortion(portion) > 0)
    .sort((left, right) => recoveryPriceForPortion(left) - recoveryPriceForPortion(right))
}

export function salePortionLabel(portion: PortionSize) {
  const recoveryPrice = recoveryPriceForPortion(portion)
  return `${portion.name} - recupera ${formatMoney(recoveryPrice)}`
}
