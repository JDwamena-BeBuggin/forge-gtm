import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, activities } from '@/lib/db/schema'
import { eq, ilike, or, sql, and, desc, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  linkedinUrl: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  industry: z.string().optional(),
  gtmStatus: z.string().optional(),
  source: z.string().optional(),
  segment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dealValue: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error

  const { searchParams } = req.nextUrl
  const segment = searchParams.get('segment')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const sort = searchParams.get('sort') ?? 'createdAt'
  const order = searchParams.get('order') ?? 'desc'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const conditions = []
  if (segment) conditions.push(eq(leads.segment, segment))
  if (status) conditions.push(eq(leads.gtmStatus, status))
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

  const rows = await db
    .select()
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)

  return NextResponse.json({ leads: rows, total: count, limit, offset })
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [lead] = await db
    .insert(leads)
    .values(parsed.data)
    .onConflictDoNothing()
    .returning()

  if (!lead) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })

  await db.insert(activities).values({ leadId: lead.id, type: 'imported', metadata: { source: 'manual' } })

  return NextResponse.json(lead, { status: 201 })
}
