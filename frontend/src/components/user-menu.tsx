import { LogOut, Moon, Sun } from 'lucide-react'

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
  theme: 'light' | 'dark'
  onLogout: () => void
  onToggleTheme: () => void
}

function UserMenu({ user, theme, onLogout, onToggleTheme }: UserMenuProps) {
  const isDark = theme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-2xl"
          aria-label="Abrir menú de usuario"
        >
          <UserAvatar user={user} className="size-9" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(260px,calc(100vw-2rem))] rounded-2xl p-2">
        <DropdownMenuLabel className="flex items-center gap-3 rounded-xl px-2 py-2">
          <UserAvatar user={user} className="size-10" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{user.full_name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleTheme}>
          {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
          {isDark ? 'Usar modo claro' : 'Usar modo oscuro'}
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
