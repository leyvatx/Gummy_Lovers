import { useMemo, useState } from 'react'
import {
  Boxes,
  ChevronRight,
  LayoutDashboard,
  Package2,
  Search,
  Tags,
  Truck,
  UserRoundPlus,
  X,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type AppSection =
  | 'dashboard'
  | 'suppliers'
  | 'products'
  | 'portions'
  | 'customers'
  | 'lots'

type SidebarSection = {
  key: AppSection
  label: string
  helper: string
  icon: typeof LayoutDashboard
}

type AppSidebarProps = {
  currentSection: AppSection
  isExpanded: boolean
  isMobile: boolean
  isMobileOpen: boolean
  onCloseMobile: () => void
  onSelect: (section: AppSection) => void
  onToggle: () => void
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
    helper: 'Catálogo maestro',
    icon: Package2,
  },
  {
    key: 'portions',
    label: 'Porciones',
    helper: 'Tamaño por producto',
    icon: Tags,
  },
  {
    key: 'customers',
    label: 'Clientes',
    helper: 'Mayoristas y saldo',
    icon: UserRoundPlus,
  },
  {
    key: 'lots',
    label: 'Lotes',
    helper: 'Inventario de entrada',
    icon: Boxes,
  },
]

function AppSidebar({
  currentSection,
  isExpanded,
  isMobile,
  isMobileOpen,
  onCloseMobile,
  onSelect,
  onToggle,
}: AppSidebarProps) {
  const [search, setSearch] = useState('')

  const filteredSections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return sections
    }

    return sections.filter((section) =>
      `${section.label} ${section.helper}`.toLowerCase().includes(normalizedSearch),
    )
  }, [search])

  return (
    <>
      {isMobile ? (
        <button
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          type="button"
          aria-label="Cerrar menú lateral"
          tabIndex={isMobileOpen ? 0 : -1}
        />
      ) : null}

      <aside className="sidebar" aria-hidden={isMobile ? !isMobileOpen : undefined}>
        <div className="sidebar-surface">
          <div className="sidebar-header">
            <div className="sidebar-brand-link">
              <span className="sidebar-brand-mark text-sm font-black text-foreground">GL</span>
              <span className="sidebar-brand-copy">
                <span className="sidebar-brand-eyebrow">Gummy Lover&apos;s</span>
                <strong className="sidebar-brand-title">Control Hub</strong>
              </span>
            </div>

            {isMobile ? (
              <button
                className="sidebar-mobile-close"
                onClick={onCloseMobile}
                type="button"
                aria-label="Cerrar sidebar"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="sidebar-body">
            <div className="sidebar-search-shell">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 rounded-2xl border-[var(--ui-border)] bg-background/80 pl-9 shadow-none"
                  placeholder="Buscar módulo"
                />
              </div>
            </div>

            <nav className="sidebar-items">
              {filteredSections.map((section) => {
                const ItemIcon = section.icon
                const active = currentSection === section.key

                return (
                  <button
                    key={section.key}
                    type="button"
                    className={cn('sidebar-item-link', active && 'active')}
                    onClick={() => onSelect(section.key)}
                    title={!isExpanded && !isMobile ? section.label : undefined}
                  >
                    <span className="sidebar-item-link-icon-content">
                      <ItemIcon className="size-4" />
                    </span>
                    <span className="sidebar-item-link-label">{section.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {!isMobile ? (
          <button className="sidebar-toggle-btn" onClick={onToggle} type="button" aria-label="Cambiar tamaño del sidebar">
            <ChevronRight className="size-4" />
          </button>
        ) : null}
      </aside>
    </>
  )
}

export { AppSidebar }
