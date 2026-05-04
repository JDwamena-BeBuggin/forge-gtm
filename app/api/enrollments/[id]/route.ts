import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sequenceEnrollments, activities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error
  const { id } = await params
  const { action } = await req.json() as { action: string }
  const STATUS_MAP: Record<string, string> = {
    pause: 'paused',
    resume: 'active',
    stop: 'stopped_manual',
  }
  const newStatus = STATUS_MAP[action]
  if (!newStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  const [enrollment] = await db.select().from(sequenceEnrollments).where(eq(sequenceEnrollments.id, id)).limit(1)
  if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [updated] = await db
    .update(sequenceEnrollments)
    .set({ status: newStatus, ...(newStatus === 'stopped_manual' ? { completedAt: new Date() } : {}) })
    .where(eq(sequenceEnrollments.id, id))
    .returning()
  if (newStatus === 'stopped_manual') {
    await db.insert(activities).values({
      leadId: enrollment.leadId,
      type: 'unenrolled',
      metadata: { action, sequenceId: enrollment.sequenceId },
    })
  }
  return NextResponse.json(updated)
}
