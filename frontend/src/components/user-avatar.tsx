import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { AuthUser } from '@/lib/api'

function initialsFromUser(user: Pick<AuthUser, 'first_name' | 'last_name' | 'full_name'>) {
  const first = user.first_name?.[0]
  const last = user.last_name?.[0]

  if (first || last) {
    return `${first ?? ''}${last ?? ''}`.toUpperCase()
  }

  return user.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function UserAvatar({ user, className }: { user: AuthUser; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-gradient-to-br from-pink-400 via-rose-500 to-orange-400 font-semibold text-white">
        {initialsFromUser(user)}
      </AvatarFallback>
    </Avatar>
  )
}

export { UserAvatar }

