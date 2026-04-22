import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

type ThemeToggleProps = {
  theme: 'light' | 'dark'
  onToggle: () => void
}

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark'

  return (
    <Button variant="outline" size="icon" onClick={onToggle} aria-label={isDark ? 'Usar modo claro' : 'Usar modo oscuro'}>
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}

export { ThemeToggle }

