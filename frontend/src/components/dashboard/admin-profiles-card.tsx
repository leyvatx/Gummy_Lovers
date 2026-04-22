import { ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import type { AuthUser } from '@/lib/api'

type AdminProfilesCardProps = {
  admins: AuthUser[]
}

function AdminProfilesCard({ admins }: AdminProfilesCardProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Perfiles admin
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:pt-5">
        {admins.map((admin) => (
          <div key={admin.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-background/45 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar user={admin} className="size-10" />
              <div className="min-w-0">
                <p className="truncate font-medium">{admin.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
              </div>
            </div>
            <Badge variant="secondary">Admin</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export { AdminProfilesCard }
