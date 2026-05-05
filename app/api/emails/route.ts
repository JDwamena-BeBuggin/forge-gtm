import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { emails } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { getRuntimeEnv } from '@/lib/runtime-env'

export async function GET(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  const leadId = req.nextUrl.searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
  const rows = await db.select().from(emails).where(eq(emails.leadId, leadId))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  const body = await req.json()
  const env = getRuntimeEnv()
  const fromAddress =
    body.fromAddress ??
    `${env.DEFAULT_FROM_NAME ?? 'Forge GTM'} <${env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com'}>`
  const [email] = await db
    .insert(emails)
    .values({
      leadId: body.leadId,
      enrollmentId: body.enrollmentId ?? null,
      stepId: body.stepId ?? null,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText ?? null,
      generationModel: body.generationModel ?? null,
      generationPrompt: body.generationPrompt ?? null,
      status: body.scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      fromAddress,
      replyTo: body.replyTo ?? null,
      requiresApproval: body.requiresApproval ?? false,
    })
    .returning()
  return NextResponse.json(email)
}
