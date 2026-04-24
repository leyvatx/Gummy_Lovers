import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type MetricCardProps = {
  title: string
  value: string
  helper: string
  icon: LucideIcon
  tone: 'rose' | 'emerald' | 'amber' | 'cyan'
}

const tones = {
  rose: 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-400/10 dark:text-pink-100 dark:border-pink-300/15',
  emerald: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 dark:bg-fuchsia-400/10 dark:text-fuchsia-100 dark:border-fuchsia-300/15',
  amber: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-400/10 dark:text-rose-100 dark:border-rose-300/15',
  cyan: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-400/10 dark:text-purple-100 dark:border-purple-300/15',
}

function MetricCard({ title, value, helper, icon: Icon, tone }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
        <div className={cn('rounded-lg border p-2', tones[tone])}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="break-words text-xl font-semibold leading-tight tabular-nums tracking-normal min-[380px]:text-2xl sm:text-3xl">
          {value}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

export { MetricCard }
