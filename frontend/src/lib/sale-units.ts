import { toNumber, type PortionSize, type Product } from '@/lib/api'

function normalizeName(value: string) {
  return value.trim().toLowerCase().replaceAll(' ', '').replaceAll('-', '')
}

export function productRecoveryPrice(product: Product | null | undefined) {
  if (!product) {
    return 0
  }

  return toNumber(product.recovery_price)
}

export function salePortions(product: Product | null | undefined) {
  if (!product) {
    return []
  }

  return product.portions
    .filter((portion) => portion.active)
    .sort((left, right) => {
      const leftIsDefault = normalizeName(left.name) === 'unidad'
      const rightIsDefault = normalizeName(right.name) === 'unidad'

      if (leftIsDefault !== rightIsDefault) {
        return leftIsDefault ? -1 : 1
      }

      return left.name.localeCompare(right.name, 'es')
    })
}

export function salePortionForProduct(product: Product | null | undefined): PortionSize | null {
  return salePortions(product)[0] ?? null
}
