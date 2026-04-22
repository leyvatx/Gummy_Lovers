import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { CustomerBalance } from '@/lib/api'
import { toNumber } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

type CustomerTableProps = {
  customers: CustomerBalance[]
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium sm:px-5">Cliente</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Límite</th>
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
                    <div className="text-xs">{customer.phone || 'Sin teléfono'}</div>
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
                      {balance <= 0 ? 'Al día' : overLimit ? 'Sobre límite' : 'Pendiente'}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="border-t p-6 text-center text-sm text-muted-foreground">
          No hay clientes mayoristas para mostrar.
        </div>
      ) : null}
    </section>
  )
}

export { CustomerTable }
