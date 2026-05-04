import { cn, STATUS_LABELS, STATUS_COLORS, type GtmStatus } from '@/lib/utils'

export function StatusPill({ status, className }: { status: GtmStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        STATUS_COLORS[status] ?? 'bg-zinc-100 text-zinc-600',
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
