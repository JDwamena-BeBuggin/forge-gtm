import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sequenceEnrollments, sequenceSteps, activities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { addDays } from 'date-fns'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error

  const { leadIds } = await req.json() as { leadIds: string[] }
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds required' }, { status: 400 })
  }

  const [firstStep] = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, params.id))
    .orderBy(sequenceSteps.stepOrder)
    .limit(1)

  if (!firstStep) return NextResponse.json({ error: 'Sequence has no steps' }, { status: 400 })

  const nextSendAt = addDays(new Date(), firstStep.delayDays)

  let enrolled = 0
  let skipped = 0

  for (const leadId of leadIds) {
    const result = await db
      .insert(sequenceEnrollments)
      .values({
        leadId,
        sequenceId: params.id,
        status: 'active',
        currentStep: 0,
        nextSendAt,
      })
      .onConflictDoNothing()
      .returning()

    if (result.length > 0) {
      enrolled++
      await db.insert(activities).values({ leadId, type: 'enrolled', metadata: { sequenceId: params.id } })
    } else {
      skipped++
    }
  }

  return NextResponse.json({ enrolled, skipped })
}
