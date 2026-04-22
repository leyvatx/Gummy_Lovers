import { LogOut, Settings, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/user-avatar'
import type { AuthUser } from '@/lib/api'

type UserMenuProps = {
  user: AuthUser
  onLogout: () => void
}

function UserMenu({ user, onLogout }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-3 rounded-2xl px-2 sm:pr-3" aria-label="Abrir menú de usuario">
          <UserAvatar user={user} className="size-8" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-sm font-medium leading-none">{user.full_name}</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">Admin fundador</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-3">
          <UserAvatar user={user} className="size-10" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{user.full_name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <ShieldCheck className="mr-2 size-4" />
          Perfil administrador
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 size-4" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onLogout}>
          <LogOut className="mr-2 size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { UserMenu }
