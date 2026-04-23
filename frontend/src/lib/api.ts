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

export type Supplier = {
  id: string
  name: string
  phone: string
  notes: string
}

export type Customer = {
  id: string
  name: string
  kind: 'wholesale' | 'direct'
  contact_name: string
  phone: string
  address: string
  credit_limit: MoneyValue
  active: boolean
  outstanding_balance: MoneyValue
}

export type CustomerBalance = Customer

export type Partner = {
  id: string
  code: string
  user: number | null
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

export type CustomerPrice = {
  id: string
  customer: string
  customer_name: string
  product: string
  product_sku: string
  portion: string
  portion_name: string
  unit_price: MoneyValue
  active: boolean
}

export type InventoryLot = {
  id: string
  product: string
  product_sku: string
  supplier: string | null
  supplier_name: string
  lot_code: string
  boxes_qty: number
  bags_per_box: number
  kg_per_bag: MoneyValue
  box_cost: MoneyValue
  total_grams: MoneyValue
  remaining_grams: MoneyValue
  total_cost: MoneyValue
  paid_by_partner: string | null
  purchased_at: string
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

export type WholesaleSale = {
  id: string
  customer: string
  customer_name: string
  channel: 'wholesale' | 'direct'
  sold_by_partner: string | null
  sold_by_partner_name: string
  status: string
  total_amount: MoneyValue
  total_cogs: MoneyValue
  notes: string
}

export type ApiError = {
  message: string
  status?: number
  detail?: unknown
}

type AuthPayload = {
  token: string
  user: AuthUser
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const AUTH_TOKEN_STORAGE_KEY = 'gummy-auth-token'

function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? ''
}

function setStoredAuthToken(token: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

function clearStoredAuthToken() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

function normalizeList<T>(payload: T[] | { results?: T[] }) {
  if (Array.isArray(payload)) {
    return payload
  }

  return payload.results ?? []
}

function extractApiMessage(payload: unknown): string {
  if (!payload) {
    return ''
  }

  if (typeof payload === 'string') {
    return payload
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nestedMessage = extractApiMessage(item)
      if (nestedMessage) {
        return nestedMessage
      }
    }
    return ''
  }

  if (typeof payload === 'object') {
    const detail = payload as Record<string, unknown>

    if (typeof detail.detail === 'string') {
      return detail.detail
    }

    for (const value of Object.values(detail)) {
      const nestedMessage = extractApiMessage(value)
      if (nestedMessage) {
        return nestedMessage
      }
    }
  }

  return ''
}

async function request<T>(path: string, options: RequestInit = {}) {
  const authToken = getStoredAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Token ${authToken}` } : {}),
      ...options.headers,
    },
    ...options,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuthToken()
    }

    const message = extractApiMessage(payload) || 'La API no pudo procesar la operacion.'
    throw { message, status: response.status, detail: payload } satisfies ApiError
  }

  return payload as T
}

export async function login(payload: { email: string; password: string }) {
  const authPayload = await request<AuthPayload>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  setStoredAuthToken(authPayload.token)
  return authPayload.user
}

export async function logout() {
  try {
    if (getStoredAuthToken()) {
      await request<void>('/api/auth/logout/', {
        method: 'POST',
      })
    }
  } finally {
    clearStoredAuthToken()
  }
}

export function getCurrentUser() {
  if (!getStoredAuthToken()) {
    throw { message: 'Sesion no iniciada.', status: 401 } satisfies ApiError
  }

  return request<AuthUser>('/api/auth/me/')
}

export function getAdminProfiles() {
  return request<AuthUser[]>('/api/auth/admins/')
}

export function getFinancialSnapshot() {
  return request<FinancialSnapshot>('/api/dashboard/financial/')
}

export async function getSuppliers() {
  const payload = await request<Supplier[] | { results?: Supplier[] }>('/api/suppliers/')
  return normalizeList(payload)
}

export async function getCustomers() {
  const payload = await request<Customer[] | { results?: Customer[] }>('/api/customers/?active=true&kind=wholesale')
  return normalizeList(payload)
}

export async function getCustomerBalances() {
  return getCustomers()
}

export async function getProducts() {
  const payload = await request<Product[] | { results?: Product[] }>('/api/products/?active=true')
  return normalizeList(payload)
}

export async function getCustomerPrices() {
  const payload = await request<CustomerPrice[] | { results?: CustomerPrice[] }>('/api/customer-prices/?active=true')
  return normalizeList(payload)
}

export async function getInventoryLots() {
  const payload = await request<InventoryLot[] | { results?: InventoryLot[] }>('/api/inventory-lots/')
  return normalizeList(payload)
}

export async function getPartners() {
  const payload = await request<Partner[] | { results?: Partner[] }>('/api/partners/?active=true')
  return normalizeList(payload)
}

export function createSupplier(payload: {
  name: string
  phone: string
  notes: string
}) {
  return request<Supplier>('/api/suppliers/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createProduct(payload: {
  sku: string
  name: string
  grams_per_piece: string
}) {
  return request<Product>('/api/products/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, active: true }),
  })
}

export function createPortion(payload: {
  product: string
  name: string
  pieces_per_portion: number
}) {
  return request<PortionSize>('/api/portions/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, active: true }),
  })
}

export function createCustomer(payload: {
  name: string
  contact_name: string
  phone: string
  address: string
  credit_limit: string
}) {
  return request<Customer>('/api/customers/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, kind: 'wholesale', active: true }),
  })
}

export function createCustomerPrice(payload: {
  customer: string
  product: string
  portion: string
  unit_price: string
}) {
  return request<CustomerPrice>('/api/customer-prices/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, active: true }),
  })
}

export function createInventoryLot(payload: {
  product: string
  supplier?: string
  lot_code: string
  boxes_qty: number
  bags_per_box: number
  kg_per_bag: string
  box_cost: string
  purchased_at: string
}) {
  const body = {
    ...payload,
    supplier: payload.supplier || null,
  }

  return request<InventoryLot>('/api/inventory-lots/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
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

export function createWholesaleSale(payload: {
  customer: string
  notes?: string
  items: Array<{
    product: string
    portion: string
    portions_qty: number
  }>
}) {
  return request<WholesaleSale>('/api/sales/', {
    method: 'POST',
    body: JSON.stringify(payload),
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

export function hasStoredAuthToken() {
  return Boolean(getStoredAuthToken())
}

export function toNumber(value: MoneyValue) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
