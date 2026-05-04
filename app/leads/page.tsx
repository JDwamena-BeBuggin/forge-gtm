import { db } from '@/lib/db/client'
import { leads } from '@/lib/db/schema'
import { sql, and, eq, ilike, or, desc, asc } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { LeadsClient } from '@/components/leads-client'

async function getLeads(params: {
  search?: string
  status?: string
  segment?: string
  sort?: string
  order?: string
  page?: number
}) {
  const { search, status, segment, sort = 'createdAt', order = 'desc', page = 1 } = params
  const limit = 50
  const offset = (page - 1) * limit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  if (status) conditions.push(eq(leads.gtmStatus, status))
  if (segment) conditions.push(eq(leads.segment, segment))
  if (search) {
    conditions.push(
      or(
        ilike(leads.email, `%${search}%`),
        ilike(leads.company, `%${search}%`),
        ilike(leads.firstName, `%${search}%`),
        ilike(leads.lastName, `%${search}%`),
      )!,
    )
  }
  const SORT_MAP: Record<string, unknown> = {
    createdAt: leads.createdAt,
    email: leads.email,
    company: leads.company,
    firstName: leads.firstName,
    lastName: leads.lastName,
    lastContactedAt: leads.lastContactedAt,
    totalEmailsSent: leads.totalEmailsSent,
    gtmStatus: leads.gtmStatus,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCol = (SORT_MAP[sort] ?? leads.createdAt) as any
  const orderFn = order === 'asc' ? asc : desc
  const [rows, countResult, segments] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(conditions.length ? and(...conditions) : undefined),
    db
      .selectDistinct({ segment: leads.segment })
      .from(leads)
      .where(sql`segment is not null`)
      .orderBy(leads.segment),
  ])
  return {
    rows,
    count: countResult[0]?.count ?? 0,
    total: countResult[0]?.count ?? 0,
    page,
    segments: segments.map((s) => s.segment).filter(Boolean) as string[],
    limit,
    offset,
  }
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; segment?: string; sort?: string; order?: string; page?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const sp = await searchParams
  const data = await getLeads({
    search: sp.search,
    status: sp.status,
    segment: sp.segment,
    sort: sp.sort,
    order: sp.order,
    page: sp.page ? parseInt(sp.page) : 1,
  })
  return <LeadsClient initialData={data} searchParams={{ search: sp.search, status: sp.status, segment: sp.segment, sort: sp.sort, order: sp.order, page: sp.page }} />
}
