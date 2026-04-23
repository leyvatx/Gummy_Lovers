import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { Customer } from '@/lib/api'
import { toNumber } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

type CustomerTableProps = {
  customers: Customer[]
}

function CustomerTable({ customers }: CustomerTableProps) {
  const [query, setQuery] = useState('')

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return customers
      .filter((customer) => {
        if (!normalizedQuery) {
          return true
        }

        return [customer.name, customer.contact_name, customer.phone]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      })
      .sort((a, b) => toNumber(b.outstanding_balance) - toNumber(a.outstanding_balance))
  }, [customers, query])

  return (
    <section className="rounded-lg border bg-card shadow-soft">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-base font-semibold">Clientes mayoristas</h2>
          <p className="text-sm text-muted-foreground">Saldos pendientes por distribuidor.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Buscar cliente"
          />
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="border-t p-6 text-center text-sm text-muted-foreground">
          No hay clientes mayoristas para mostrar.
        </div>
      ) : (
        <>
          <div className="grid gap-3 p-4 md:hidden">
            {filteredCustomers.map((customer) => {
              const balance = toNumber(customer.outstanding_balance)
              const creditLimit = toNumber(customer.credit_limit)
              const overLimit = creditLimit > 0 && balance > creditLimit

              return (
                <article key={customer.id} className="rounded-2xl border bg-background/60 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{customer.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{customer.contact_name || 'Sin contacto'}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        balance <= 0 && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                        overLimit && 'border-amber-200 bg-amber-50 text-amber-800',
                      )}
                    >
                      {balance <= 0 ? 'Al dia' : overLimit ? 'Sobre limite' : 'Pendiente'}
                    </Badge>
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Telefono</dt>
                      <dd>{customer.phone || 'Sin telefono'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Limite</dt>
                      <dd className="tabular-nums">{formatMoney(customer.credit_limit)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Saldo</dt>
                      <dd className="font-semibold tabular-nums">{formatMoney(customer.outstanding_balance)}</dd>
                    </div>
                  </dl>
                </article>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Cliente</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Limite</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  <th className="px-4 py-3 text-right font-medium sm:px-5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const balance = toNumber(customer.outstanding_balance)
                  const creditLimit = toNumber(customer.credit_limit)
                  const overLimit = creditLimit > 0 && balance > creditLimit

                  return (
                    <tr key={customer.id} className="border-t">
                      <td className="px-4 py-4 font-medium sm:px-5">{customer.name}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <div>{customer.contact_name || 'Sin contacto'}</div>
                        <div className="text-xs">{customer.phone || 'Sin telefono'}</div>
                      </td>
                      <td className="px-4 py-4 tabular-nums text-muted-foreground">{formatMoney(customer.credit_limit)}</td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatMoney(customer.outstanding_balance)}</td>
                      <td className="px-4 py-4 text-right sm:px-5">
                        <Badge
                          variant="outline"
                          className={cn(
                            balance <= 0 && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                            overLimit && 'border-amber-200 bg-amber-50 text-amber-800',
                          )}
                        >
                          {balance <= 0 ? 'Al dia' : overLimit ? 'Sobre limite' : 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export { CustomerTable }
