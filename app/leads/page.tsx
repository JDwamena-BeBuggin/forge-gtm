import { redirect } from 'next/navigation'
import { StatusPill } from '@/components/status-pill'
import { SetupState } from '@/components/setup-state'
import { formatRelative, type GtmStatus } from '@/lib/utils'
import { hasClerkRuntimeEnv, hasDatabaseRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'

const DEMO_LEADS = [
  {
    id: 'demo-lead-1',
    email: 'ava@northstarhq.com',
    firstName: 'Ava',
    lastName: 'Morgan',
    company: 'Northstar HQ',
    gtmStatus: 'engaged' as GtmStatus,
    segment: 'SaaS',
    lastContactedAt: new Date(),
  },
  {
    id: 'demo-lead-2',
    email: 'leo@brightforge.ai',
    firstName: 'Leo',
    lastName: 'Chen',
    company: 'Brightforge AI',
    gtmStatus: 'queued' as GtmStatus,
    segment: 'AI',
    lastContactedAt: null,
  },
]

function LeadsDemoView() {
  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Leads is running in demo mode because the database connection is not ready yet.
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-light">Leads</h1>
        <p className="text-sm text-[#6b6560] mt-0.5">{DEMO_LEADS.length} sample leads</p>
      </div>
      <div className="bg-white rounded-xl border border-[#e8e4dc] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e8e4dc] bg-[#faf9f6]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9b9589] uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9b9589] uppercase tracking-wide">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9b9589] uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9b9589] uppercase tracking-wide">Segment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9b9589] uppercase tracking-wide">Last Contact</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_LEADS.map((lead) => (
              <tr key={lead.id} className="border-b border-[#f0ede8]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#1a1814]">{`${lead.firstName} ${lead.lastName}`}</p>
                  <p className="text-xs text-[#9b9589] font-mono">{lead.email}</p>
                </td>
                <td className="px-4 py-3 text-[#3a362e]">{lead.company}</td>
                <td className="px-4 py-3">
                  <StatusPill status={lead.gtmStatus} />
                </td>
                <td className="px-4 py-3 text-[#6b6560]">{lead.segment}</td>
                <td className="px-4 py-3 text-[#9b9589]">{formatRelative(lead.lastContactedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; segment?: string; sort?: string; order?: string; page?: string }>
}) {
  const authDisabled = isAuthDisabled()

  if (!authDisabled && !hasClerkRuntimeEnv()) {
    return <SetupState title="Leads view is waiting on auth setup" />
  }

  if (authDisabled || !hasDatabaseRuntimeEnv()) {
    return <LeadsDemoView />
  }

  const { auth } = await import('@clerk/nextjs/server')
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const sp = await searchParams
  const requestedPage = sp.page ? parseInt(sp.page) : 1

  const [{ db }, { leads: leadsTable }, { LeadsClient }, drizzle] = await Promise.all([
    import('@/lib/db/client'),
    import('@/lib/db/schema'),
    import('@/components/leads-client'),
    import('drizzle-orm'),
  ])

  const { sql, and, eq, ilike, or, desc, asc } = drizzle

  const limit = 50
  const offset = (requestedPage - 1) * limit
  const conditions: ReturnType<typeof eq>[] = []

  if (sp.status) conditions.push(eq(leadsTable.gtmStatus, sp.status))
  if (sp.segment) conditions.push(eq(leadsTable.segment, sp.segment))
  if (sp.search) {
    conditions.push(
      or(
        ilike(leadsTable.email, `%${sp.search}%`),
        ilike(leadsTable.company, `%${sp.search}%`),
        ilike(leadsTable.firstName, `%${sp.search}%`),
        ilike(leadsTable.lastName, `%${sp.search}%`),
      )!,
    )
  }

  const sort = sp.sort ?? 'createdAt'
  const order = sp.order ?? 'desc'
  const SORT_MAP: Record<string, unknown> = {
    createdAt: leadsTable.createdAt,
    email: leadsTable.email,
    company: leadsTable.company,
    firstName: leadsTable.firstName,
    lastName: leadsTable.lastName,
    lastContactedAt: leadsTable.lastContactedAt,
    totalEmailsSent: leadsTable.totalEmailsSent,
    gtmStatus: leadsTable.gtmStatus,
  }
  const sortCol = SORT_MAP[sort] ?? leadsTable.createdAt
  const orderFn = order === 'asc' ? asc : desc

  const [rows, countResult, segments] = await Promise.all([
    db
      .select()
      .from(leadsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(orderFn(sortCol as never))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leadsTable)
      .where(conditions.length ? and(...conditions) : undefined),
    db
      .selectDistinct({ segment: leadsTable.segment })
      .from(leadsTable)
      .where(sql`segment is not null`)
      .orderBy(leadsTable.segment),
  ])

  const data = {
    rows,
    count: countResult[0]?.count ?? 0,
    total: countResult[0]?.count ?? 0,
    page: requestedPage,
    segments: segments.map((s) => s.segment).filter(Boolean) as string[],
    limit,
    offset,
  }

  return <LeadsClient initialData={data} searchParams={{ search: sp.search, status: sp.status, segment: sp.segment, sort: sp.sort, order: sp.order, page: sp.page }} />
}
