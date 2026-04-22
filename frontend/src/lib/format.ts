import { toNumber, type MoneyValue } from '@/lib/api'

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

export function formatMoney(value: MoneyValue) {
  return moneyFormatter.format(toNumber(value))
}

export function formatCompactMoney(value: MoneyValue) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toNumber(value))
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

