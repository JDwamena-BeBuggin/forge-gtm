import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, sequenceSteps, emails } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { generateEmail } from '@/lib/anthropic'
import { bodyToHtml } from '@/lib/utils'

const AD_HOC_STEP = {
  id: 'adhoc',
  sequenceId: 'adhoc',
  stepOrder: 1,
  delayDays: 0,
  subjectPrompt: 'Write a short, personalised cold outreach subject line',
  bodyPrompt: 'Write a personalised cold outreach email',
  sendWindowStart: null,
  sendWindowEnd: null,
  timezone: 'America/New_York',
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  const body = await req.json() as { leadId: string; stepId?: string; customPrompt?: string }
  const { leadId, stepId, customPrompt } = body
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let step: any = AD_HOC_STEP
  if (stepId) {
    const [s] = await db.select().from(sequenceSteps).where(eq(sequenceSteps.id, stepId)).limit(1)
    if (s) step = s
  }
  const priorEmails = await db
    .select()
    .from(emails)
    .where(eq(emails.leadId, leadId))
    .limit(5)
  const generated = await generateEmail(lead, step, priorEmails, customPrompt)
  const fromAddress = `${process.env.DEFAULT_FROM_NAME ?? 'Forge GTM'} <${process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com'}>`
  const [draft] = await db.insert(emails).values({
    leadId,
    stepId: stepId ?? null,
    subject: generated.subject,
    bodyHtml: bodyToHtml(generated.body),
    bodyText: generated.body,
    generationModel: generated.model,
    generationPrompt: generated.prompt,
    fromAddress,
  }).returning()
  return NextResponse.json(draft)
}
