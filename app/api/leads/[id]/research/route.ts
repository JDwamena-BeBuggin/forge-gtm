import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, activities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { generateResearch } from '@/lib/anthropic'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error
  const { id } = await params
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const notes = await generateResearch(lead)
  await db
    .update(leads)
    .set({ researchNotes: notes, researchUpdatedAt: new Date() })
    .where(eq(leads.id, id))
  await db.insert(activities).values({ leadId: id, type: 'researched', metadata: {} })
  return NextResponse.json({ notes })
}
