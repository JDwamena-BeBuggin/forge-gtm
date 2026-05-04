import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads } from '@/lib/db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

const FUNNEL_ORDER = ['new', 'contacted', 'engaged', 'qualified', 'demo', 'proposal', 'closed_won', 'closed_lost']

export async function GET(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  const searchParams = req.nextUrl.searchParams
  const segment = searchParams.get('segment')
  const since = searchParams.get('since')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  if (segment) conditions.push(eq(leads.segment, segment))
  if (since) conditions.push(gte(leads.createdAt, new Date(since)))
  const rows = await db
    .select({
      status: leads.gtmStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(leads.gtmStatus)
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]))
  return NextResponse.json({
    funnel: FUNNEL_ORDER.map((s) => ({ status: s, count: byStatus[s] ?? 0 })),
    other: rows.filter((r) => !FUNNEL_ORDER.includes(r.status ?? '')),
  })
}
