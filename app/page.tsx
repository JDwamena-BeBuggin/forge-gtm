import { db } from '@/lib/db/client'
import { leads, activities } from '@/lib/db/schema'
import { sql, desc, gte, eq } from 'drizzle-orm'
import { subDays } from 'date-fns'
import { StatusPill } from '@/components/status-pill'
import { formatRelative, STATUS_LABELS, type GtmStatus } from '@/lib/utils'
import { TrendingUp, Mail, MousePointer, MessageSquare, Users } from 'lucide-react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasClerkRuntimeEnv } from '@/lib/runtime-env'
import { SetupState } from '@/components/setup-state'

const PIPELINE: GtmStatus[] = ['new', 'researching', 'queued', 'contacted', 'engaged', 'qualified', 'closed_won', 'closed_lost']

const ACTIVITY_ICONS: Record<string, string> = {
  email_sent: '📤',
  email_opened: '👁',
  email_clicked: '🔗',
  reply_received: '💬',
  enrolled: '➕',
  status_changed: '🔄',
  note_added: '📝',
  research_generated: '🔬',
  imported: '📥',
}

async function getStats() {
  const since30d = subDays(new Date(), 30)
  const [byStatusRows, totals, recentActivity] = await Promise.all([
    db.select({ status: leads.gtmStatus, count: sql<number>`count(*)::int` })
      .from(leads).groupBy(leads.gtmStatus),
    db.select({
      totalLeads: sql<number>`count(*)::int`,
      totalSent: sql<number>`coalesce(sum(total_emails_sent),0)::int`,
      totalOpens: sql<number>`coalesce(sum(total_opens),0)::int`,
      totalReplies: sql<number>`coalesce(sum(total_replies),0)::int`,
    }).from(leads),
    db.select({
      id: activities.id,
      type: activities.type,
      metadata: activities.metadata,
      createdAt: activities.createdAt,
      leadEmail: leads.email,
      leadFirstName: leads.firstName,
      leadLastName: leads.lastName,
      leadCompany: leads.company,
    })
      .from(activities)
      .leftJoin(leads, eq(activities.leadId, leads.id))
      .orderBy(desc(activities.createdAt))
      .limit(8),
  ])
  const byStatus = Object.fromEntries(byStatusRows.map((r) => [r.status, r.count]))
  const t = totals[0]
  return {
    byStatus,
    total: t?.totalLeads ?? 0,
    sent: t?.totalSent ?? 0,
    opens: t?.totalOpens ?? 0,
    replies: t?.totalReplies ?? 0,
    openRate: t?.totalSent ? (((t.totalOpens ?? 0) / t.totalSent) * 100).toFixed(1) : '0',
    replyRate: t?.totalSent ? (((t.totalReplies ?? 0) / t.totalSent) * 100).toFixed(1) : '0',
    recentActivity,
  }
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e8e4dc] p-5">
      <div className="flex items-center gap-2 text-[#9b9589] mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-serif font-light text-[#1a1814]">{value}</p>
    </div>
  )
}

export default async function DashboardPage() {
  if (!hasClerkRuntimeEnv()) {
    return (
      <SetupState
        title="Authentication still needs to be finalized"
        description="Forge GTM is deployed, but Clerk is not booting correctly in production yet. Once the live Clerk keys are available to the worker, the dashboard will load normally."
      />
    )
  }

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const stats = await getStats()
  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-light text-[#1a1814]">Dashboard</h1>
        <p className="text-sm text-[#6b6560] mt-1">{stats.total.toLocaleString()} leads in pipeline</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={<Users size={18} />} label="Total Leads" value={stats.total.toLocaleString()} />
        <KpiCard icon={<Mail size={18} />} label="Emails Sent" value={stats.sent.toLocaleString()} />
        <KpiCard icon={<MousePointer size={18} />} label="Open Rate" value={`${stats.openRate}%`} />
        <KpiCard icon={<MessageSquare size={18} />} label="Reply Rate" value={`${stats.replyRate}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Funnel */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[#e8e4dc] p-6">
          <h2 className="font-serif text-lg mb-5">Pipeline</h2>
          <div className="space-y-3">
            {PIPELINE.map((status) => {
              const count = stats.byStatus[status] ?? 0
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <StatusPill status={status as GtmStatus} />
                  <div className="flex-1 h-2 bg-[#f0ede8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#c2410c] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono text-[#6b6560] w-10 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#e8e4dc] p-6">
          <h2 className="font-serif text-lg mb-5">Recent Activity</h2>
          <div className="space-y-3">
            {stats.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{ACTIVITY_ICONS[a.type] ?? '•'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#1a1814] leading-snug truncate">
                    {a.leadFirstName ?? ''} {a.leadLastName ?? a.leadEmail ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-[#9b9589]">
                    {a.type.replace(/_/g, ' ')} · {formatRelative(a.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {stats.recentActivity.length === 0 && (
              <p className="text-sm text-[#9b9589]">No activity yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
