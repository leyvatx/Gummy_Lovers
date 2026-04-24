import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
  const hasActiveFilters = Boolean(query.trim()) || status !== 'all' || channel !== 'all'

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-10 rounded-2xl border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-300/15 dark:bg-pink-400/10 dark:text-pink-100"
          title="Buscar ventas"
        >
          <Search className="size-4" />
          {hasActiveFilters ? (
            <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" aria-hidden="true" />
          ) : null}
          <span className="sr-only">Buscar ventas</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-none overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:max-w-none sm:p-6">
        <SheetHeader>
          <SheetTitle>Buscar ventas</SheetTitle>
          <SheetDescription>Filtra por texto, estado y tipo de venta.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 pb-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="sales-search">
              Búsqueda
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sales-search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                className="h-10 rounded-2xl pl-9"
                placeholder="Producto, socio o nota"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="sales-status-filter">
              Estado
            </label>
            <Select value={status} onValueChange={(value) => onStatusChange(value as SaleStatusFilter)}>
              <SelectTrigger id="sales-status-filter" className="h-10 rounded-2xl">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagada</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="delivered">Pendiente</SelectItem>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="sales-channel-filter">
              Tipo de venta
            </label>
            <Select value={channel} onValueChange={(value) => onChannelChange(value as SaleChannelFilter)}>
              <SelectTrigger id="sales-channel-filter" className="h-10 rounded-2xl">
                <SelectValue placeholder="Tipo de venta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="direct">Venta propia</SelectItem>
                <SelectItem value="wholesale">Venta a proveedores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onQueryChange('')
                onStatusChange('all')
                onChannelChange('all')
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { SalesFilters }
