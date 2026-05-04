import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const GTM_STATUSES = [
  'new', 'researching', 'queued', 'contacted', 'engaged',
  'qualified', 'closed_won', 'closed_lost', 'unsubscribed', 'bounced',
] as const

export type GtmStatus = typeof GTM_STATUSES[number]

export const STATUS_LABELS: Record<GtmStatus, string> = {
  new: 'New',
  researching: 'Researching',
  queued: 'Queued',
  contacted: 'Contacted',
  engaged: 'Engaged',
  qualified: 'Qualified',
  closed_won: 'Won',
  closed_lost: 'Lost',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
}

export const STATUS_COLORS: Record<GtmStatus, string> = {
  new: 'bg-zinc-100 text-zinc-700',
  researching: 'bg-blue-50 text-blue-700',
  queued: 'bg-amber-50 text-amber-700',
  contacted: 'bg-orange-50 text-orange-700',
  engaged: 'bg-emerald-50 text-emerald-700',
  qualified: 'bg-green-100 text-green-800',
  closed_won: 'bg-green-200 text-green-900',
  closed_lost: 'bg-red-50 text-red-700',
  unsubscribed: 'bg-zinc-100 text-zinc-500',
  bounced: 'bg-red-100 text-red-600',
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return 'Never'
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function bodyToHtml(text: string): string {
  return `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#1a1814;max-width:600px">
${text.split('\n').map(l => `<p style="margin:0 0 12px">${l}</p>`).join('')}
</div>`
}
