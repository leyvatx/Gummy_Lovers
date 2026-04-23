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
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-[var(--ui-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ui-card)_94%,transparent),color-mix(in_srgb,var(--ui-highlight)_6%,var(--ui-card)))] shadow-[var(--ui-shadow-card)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--ui-highlight)_16%,transparent),transparent_34%)]" />

      <div className="relative flex items-center gap-3 px-3 pb-2 pt-3">
        <div className="grid size-[52px] shrink-0 place-items-center rounded-[18px] border border-[var(--ui-border)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--ui-highlight)_20%,rgba(255,255,255,0.14)),transparent_60%),var(--ui-card)] text-sm font-black text-foreground shadow-[var(--ui-shadow-soft)]">
          GL
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Gummy Lover&apos;s</p>
          <p className="truncate text-[0.95rem] font-semibold tracking-[-0.03em] text-foreground">Control Hub</p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 px-3 pb-3">
        <nav className="grid gap-1.5">
          {sections.map((section) => {
            const ItemIcon = section.icon
            const active = currentSection === section.key

            return (
              <Button
                key={section.key}
                variant="ghost"
                className={cn(
                  'h-auto min-h-[54px] justify-start rounded-[18px] border border-transparent px-3 py-2.5 text-left text-foreground',
                  active
                    ? 'border-[color:color-mix(in_srgb,var(--ui-highlight)_16%,var(--ui-border))] bg-[color:color-mix(in_srgb,var(--ui-highlight)_10%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ui-highlight)_10%,transparent)]'
                    : 'hover:bg-accent/70',
                )}
                onClick={() => onSelect(section.key)}
              >
                <span
                  className={cn(
                    'mr-3 grid size-9 shrink-0 place-items-center rounded-[14px] border transition-colors',
                    active
                      ? 'border-[color:color-mix(in_srgb,var(--ui-highlight)_18%,var(--ui-border))] bg-[color:color-mix(in_srgb,var(--ui-highlight)_12%,transparent)] text-[var(--ui-highlight)]'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  <ItemIcon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{section.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{section.helper}</span>
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
