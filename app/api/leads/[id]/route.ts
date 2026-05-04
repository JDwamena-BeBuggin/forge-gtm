import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, emails, replies, activities } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error
  const { id } = await params
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [emailList, replyList, activityList] = await Promise.all([
    db.select().from(emails).where(eq(emails.leadId, id)).orderBy(desc(emails.createdAt)).limit(50),
    db.select().from(replies).where(eq(replies.leadId, id)).orderBy(desc(replies.receivedAt)).limit(20),
    db.select().from(activities).where(eq(activities.leadId, id)).orderBy(desc(activities.createdAt)).limit(50),
  ])
  return NextResponse.json({ ...lead, emails: emailList, replies: replyList, activities: activityList })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error
  const { id } = await params
  const body = await req.json()
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updates: Record<string, unknown> = {}
  const allowedFields = [
    'firstName', 'lastName', 'company', 'title', 'linkedinUrl', 'website',
    'phone', 'industry', 'gtmStatus', 'source', 'segment', 'tags',
    'dealValue', 'notes', 'researchNotes',
  ]
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }
  if ('gtmStatus' in updates) {
    await db.insert(activities).values({
      leadId: id,
      type: 'status_changed',
      metadata: { from: lead.gtmStatus, to: updates.gtmStatus },
    })
  }
  if ('notes' in updates) {
    await db.insert(activities).values({ leadId: id, type: 'note_added', metadata: {} })
  }
  const [updated] = await db
    .update(leads)
    .set(updates as Partial<typeof leads.$inferInsert>)
    .where(eq(leads.id, id))
    .returning()
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error
  const { id } = await params
  await db.delete(leads).where(eq(leads.id, id))
  return new NextResponse(null, { status: 204 })
}
