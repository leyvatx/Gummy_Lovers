export type MoneyValue = string | number

export type DashboardPartner = {
  partner_id: string
  code: string
  name: string
  expenses_paid: MoneyValue
  reimbursements_allocated: MoneyValue
  reimbursements_pending_to_allocate: MoneyValue
  reimbursements_available_to_payout: MoneyValue
  profit_allocated: MoneyValue
  profit_available_to_payout: MoneyValue
  total_payouts: MoneyValue
  net_partner_balance: MoneyValue
}

export type FinancialSnapshot = {
  cash_on_hand: MoneyValue
  accounts_receivable: MoneyValue
  pending_expense_reimbursements: MoneyValue
  partner_reimbursements_available: MoneyValue
  inventory_reserve_allocated: MoneyValue
  net_profit_available: MoneyValue
  partners: DashboardPartner[]
}

export type CustomerBalance = {
  id: string
  name: string
  contact_name: string
  phone: string
  credit_limit: MoneyValue
  outstanding_balance: MoneyValue
}

export type Partner = {
  id: string
  code: string
  name: string
  active: boolean
}

export type PortionSize = {
  id: string
  product: string
  product_sku: string
  product_name: string
  name: string
  pieces_per_portion: number
  active: boolean
}

export type Product = {
  id: string
  sku: string
  name: string
  grams_per_piece: MoneyValue
  active: boolean
  available_grams: MoneyValue
  portions: PortionSize[]
}

export type ApiError = {
  message: string
  status?: number
  detail?: unknown
}

export type AuthUser = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  is_staff: boolean
  is_superuser: boolean
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function normalizeList<T>(payload: T[] | { results?: T[] }) {
  if (Array.isArray(payload)) {
    return payload
  }

  return payload.results ?? []
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const message =
      typeof payload?.detail === 'string'
        ? payload.detail
        : 'La API no pudo procesar la operación.'
    throw { message, status: response.status, detail: payload } satisfies ApiError
  }

  return payload as T
}

export function login(payload: { email: string; password: string }) {
  return request<AuthUser>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function logout() {
  return request<void>('/api/auth/logout/', {
    method: 'POST',
  })
}

export function getCurrentUser() {
  return request<AuthUser>('/api/auth/me/')
}

export function getAdminProfiles() {
  return request<AuthUser[]>('/api/auth/admins/')
}

export function getFinancialSnapshot() {
  return request<FinancialSnapshot>('/api/dashboard/financial/')
}

export function getCustomerBalances() {
  return request<CustomerBalance[]>('/api/customers/balances/')
}

export async function getProducts() {
  const payload = await request<Product[] | { results?: Product[] }>('/api/products/?active=true')
  return normalizeList(payload)
}

export async function getPartners() {
  try {
    const payload = await request<Partner[] | { results?: Partner[] }>('/api/partners/?active=true')
    return normalizeList(payload)
  } catch (error) {
    if (error instanceof TypeError) {
      return []
    }
    throw error
  }
}

export function createExpense(payload: {
  category: string
  description: string
  amount: string
  incurred_at: string
}) {
  return request('/api/expenses/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, voided: false }),
  })
}

export function createPayment(payload: {
  customer: string
  amount: string
  method: string
  reference: string
}) {
  return request('/api/payments/', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      received_at: new Date().toISOString(),
    }),
  })
}

export function createDirectSale(payload: {
  product: string
  portion: string
  portions_qty: number
  unit_price: string
  method: string
  reference: string
}) {
  return request('/api/sales/direct/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function toNumber(value: MoneyValue) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
