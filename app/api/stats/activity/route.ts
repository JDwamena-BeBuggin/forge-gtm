import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { activities, leads } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)
  const rows = await db
    .select({
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
    .limit(limit)
  return NextResponse.json(rows)
}
