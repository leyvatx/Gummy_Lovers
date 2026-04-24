import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SaleChannel, SaleStatus } from '@/lib/api'

export type SaleStatusFilter = 'all' | SaleStatus
export type SaleChannelFilter = 'all' | SaleChannel

type SalesFiltersProps = {
  query: string
  status: SaleStatusFilter
  channel: SaleChannelFilter
  onQueryChange: (value: string) => void
  onStatusChange: (value: SaleStatusFilter) => void
  onChannelChange: (value: SaleChannelFilter) => void
}

function SalesFilters({
  query,
  status,
  channel,
  onQueryChange,
  onStatusChange,
  onChannelChange,
}: SalesFiltersProps) {
  return (
    <div className="flex min-w-max items-center gap-2">
      <div className="relative w-[220px] sm:w-[280px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-10 rounded-2xl pl-9"
          placeholder="Buscar venta"
        />
      </div>

      <Select value={status} onValueChange={(value) => onStatusChange(value as SaleStatusFilter)}>
        <SelectTrigger className="h-10 w-[132px] rounded-2xl">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Estados</SelectItem>
          <SelectItem value="paid">Pagada</SelectItem>
          <SelectItem value="partial">Parcial</SelectItem>
          <SelectItem value="delivered">Pendiente</SelectItem>
          <SelectItem value="draft">Borrador</SelectItem>
          <SelectItem value="cancelled">Cancelada</SelectItem>
        </SelectContent>
      </Select>

      <Select value={channel} onValueChange={(value) => onChannelChange(value as SaleChannelFilter)}>
        <SelectTrigger className="h-10 w-[138px] rounded-2xl">
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Canales</SelectItem>
          <SelectItem value="direct">Venta propia</SelectItem>
          <SelectItem value="wholesale">Mayoreo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export { SalesFilters }
