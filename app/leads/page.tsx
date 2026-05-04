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

  const conditions = []
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

  const SORT_MAP: Record<string, Parameters<typeof desc>[0]> = {
    createdAt: leads.createdAt,
    email: leads.email,
    company: leads.company,
    firstName: leads.firstName,
    lastName: leads.lastName,
    lastContactedAt: leads.lastContactedAt,
    totalEmailsSent: leads.totalEmailsSent,
    gtmStatus: leads.gtmStatus,
  }
  const sortCol = SORT_MAP[sort] ?? leads.createdAt
  const orderFn = order === 'asc' ? asc : desc

  const [rows, [{ count }], segments] = await Promise.all([
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

  return { rows, total: count, page, limit, segments: segments.map((s) => s.segment!) }
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; segment?: string; sort?: string; order?: string; page?: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const data = await getLeads({
    search: searchParams.search,
    status: searchParams.status,
    segment: searchParams.segment,
    sort: searchParams.sort,
    order: searchParams.order,
    page: searchParams.page ? parseInt(searchParams.page) : 1,
  })

  return <LeadsClient initialData={data} searchParams={searchParams} />
}
