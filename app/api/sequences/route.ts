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

  const seqs = await db.select().from(sequences).orderBy(sequences.createdAt)
  const steps = await db.select().from(sequenceSteps)

  const result = seqs.map((s) => ({
    ...s,
    steps: steps.filter((st) => st.sequenceId === s.id).sort((a, b) => a.stepOrder - b.stepOrder),
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [seq] = await db.insert(sequences).values({ name: parsed.data.name, description: parsed.data.description }).returning()

  const stepRows = parsed.data.steps.map((s) => ({ ...s, sequenceId: seq.id }))
  const insertedSteps = await db.insert(sequenceSteps).values(stepRows).returning()

  return NextResponse.json({ ...seq, steps: insertedSteps }, { status: 201 })
}
