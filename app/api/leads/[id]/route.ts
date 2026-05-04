import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, emails, replies, activities } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error

  const [lead] = await db.select().from(leads).where(eq(leads.id, params.id)).limit(1)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [leadEmails, leadReplies, leadActivities] = await Promise.all([
    db.select().from(emails).where(eq(emails.leadId, params.id)).orderBy(desc(emails.createdAt)).limit(50),
    db.select().from(replies).where(eq(replies.leadId, params.id)).orderBy(desc(replies.receivedAt)).limit(20),
    db.select().from(activities).where(eq(activities.leadId, params.id)).orderBy(desc(activities.createdAt)).limit(50),
  ])

  return NextResponse.json({ lead, emails: leadEmails, replies: leadReplies, activities: leadActivities })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error

  const body = await req.json()
  const [lead] = await db.select().from(leads).where(eq(leads.id, params.id)).limit(1)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowedFields = [
    'firstName', 'lastName', 'company', 'title', 'linkedinUrl', 'website',
    'phone', 'industry', 'gtmStatus', 'source', 'segment', 'tags',
    'dealValue', 'notes', 'researchNotes',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Log status changes
  if (updates.gtmStatus && updates.gtmStatus !== lead.gtmStatus) {
    await db.insert(activities).values({
      leadId: params.id,
      type: 'status_changed',
      metadata: { from: lead.gtmStatus, to: updates.gtmStatus },
    })
  }

  if (updates.notes && updates.notes !== lead.notes) {
    await db.insert(activities).values({ leadId: params.id, type: 'note_added', metadata: {} })
  }

  const [updated] = await db
    .update(leads)
    .set(updates as Partial<typeof leads.$inferInsert>)
    .where(eq(leads.id, params.id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error

  await db.delete(leads).where(eq(leads.id, params.id))
  return new NextResponse(null, { status: 204 })
}
