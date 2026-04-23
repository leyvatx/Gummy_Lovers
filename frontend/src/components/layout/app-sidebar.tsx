import {
  Boxes,
  LayoutDashboard,
  Package2,
  Tags,
  Truck,
  UserRoundPlus,
  Wallet2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AppSection =
  | 'dashboard'
  | 'suppliers'
  | 'products'
  | 'portions'
  | 'customers'
  | 'prices'
  | 'lots'

type SidebarSection = {
  key: AppSection
  label: string
  helper: string
  icon: typeof LayoutDashboard
}

type AppSidebarProps = {
  currentSection: AppSection
  onSelect: (section: AppSection) => void
}

const sections: SidebarSection[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    helper: 'Finanzas y cobranza',
    icon: LayoutDashboard,
  },
  {
    key: 'suppliers',
    label: 'Proveedores',
    helper: 'Compras y contactos',
    icon: Truck,
  },
  {
    key: 'products',
    label: 'Productos',
    helper: 'Catalogo maestro',
    icon: Package2,
  },
  {
    key: 'portions',
    label: 'Porciones',
    helper: 'Tamano por producto',
    icon: Tags,
  },
  {
    key: 'customers',
    label: 'Clientes',
    helper: 'Mayoristas y saldo',
    icon: UserRoundPlus,
  },
  {
    key: 'prices',
    label: 'Precios',
    helper: 'Tarifas por cliente',
    icon: Wallet2,
  },
  {
    key: 'lots',
    label: 'Lotes',
    helper: 'Inventario de entrada',
    icon: Boxes,
  },
]

function AppSidebar({ currentSection, onSelect }: AppSidebarProps) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.75rem] border border-[var(--ui-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ui-card)_98%,transparent),color-mix(in_srgb,var(--ui-highlight)_6%,var(--ui-card)))] p-4 shadow-[var(--ui-shadow-soft)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-400 via-rose-500 to-orange-400 text-sm font-black text-white shadow-[var(--ui-shadow-soft)]">
            GL
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Gummy Lover's</p>
            <p className="truncate text-base font-semibold">Control interno</p>
          </div>
        </div>

        <nav className="grid gap-1.5">
          {sections.map((section) => {
            const ItemIcon = section.icon
            const active = currentSection === section.key

            return (
              <Button
                key={section.key}
                variant="ghost"
                className={cn(
                  'h-auto justify-start rounded-2xl px-3 py-3 text-left',
                  active
                    ? 'bg-primary text-primary-foreground hover:bg-primary/95 hover:text-primary-foreground'
                    : 'hover:bg-muted/70',
                )}
                onClick={() => onSelect(section.key)}
              >
                <span
                  className={cn(
                    'mr-3 grid size-9 shrink-0 place-items-center rounded-xl border',
                    active
                      ? 'border-white/15 bg-white/10'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  <ItemIcon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{section.label}</span>
                  <span
                    className={cn(
                      'block truncate text-xs',
                      active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {section.helper}
                  </span>
                </span>
              </Button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export { AppSidebar }
