import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sequences, sequenceSteps } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const stepSchema = z.object({
  stepOrder: z.number().int(),
  delayDays: z.number().int().default(0),
  subjectPrompt: z.string(),
  bodyPrompt: z.string(),
  sendWindowStart: z.string().optional(),
  sendWindowEnd: z.string().optional(),
  timezone: z.string().optional(),
})

const createSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(stepSchema).min(1),
})

export async function GET(_req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  const [allSequences, steps] = await Promise.all([
    db.select().from(sequences),
    db.select().from(sequenceSteps),
  ])
  return NextResponse.json(allSequences.map((s) => ({
    ...s,
    steps: steps.filter((st) => st.sequenceId === s.id).sort((a, b) => a.stepOrder - b.stepOrder),
  })))
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const [sequence] = await db.insert(sequences).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  }).returning()
  const stepRows = parsed.data.steps.map((step) => ({
    ...step,
    sequenceId: sequence.id,
    sendWindowStart: step.sendWindowStart ?? null,
    sendWindowEnd: step.sendWindowEnd ?? null,
    timezone: step.timezone ?? 'America/New_York',
  }))
  const insertedSteps = await db.insert(sequenceSteps).values(stepRows).returning()
  return NextResponse.json({ ...sequence, steps: insertedSteps }, { status: 201 })
}
