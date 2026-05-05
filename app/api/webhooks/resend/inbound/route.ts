import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, emails, replies, activities, sequenceEnrollments, suppressions } from '@/lib/db/schema'
import { eq, ilike } from 'drizzle-orm'
import { classifySentiment } from '@/lib/openai'
import { Resend } from 'resend'

function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY)
}

async function parseInboundEvent(req: NextRequest) {
  const payload = await req.text()
  const secret = process.env.RESEND_WEBHOOK_SECRET

  if (!secret) {
    return JSON.parse(payload) as {
      type?: string
      data?: {
        email_id?: string
        from?: string
        to?: string[]
        subject?: string
        message_id?: string
      }
    }
  }

  const id = req.headers.get('svix-id')
  const timestamp = req.headers.get('svix-timestamp')
  const signature = req.headers.get('svix-signature')

  if (!id || !timestamp || !signature) {
    throw new Error('Missing Resend webhook signature headers')
  }

  return getResendClient().webhooks.verify({
    payload,
    headers: { id, timestamp, signature },
    webhookSecret: secret,
  }) as {
    type?: string
    data?: {
      email_id?: string
      from?: string
      to?: string[]
      subject?: string
      message_id?: string
    }
  }
}

export async function POST(req: NextRequest) {
  let event
  try {
    event = await parseInboundEvent(req)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid signature' },
      { status: 401 },
    )
  }

  if (event.type && event.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  const emailId = event.data?.email_id
  if (!emailId) {
    return NextResponse.json({ error: 'email_id is required' }, { status: 400 })
  }

  const resend = getResendClient()
  const result = await resend.emails.receiving.get(emailId)
  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error?.message ?? `Failed to retrieve inbound email ${emailId}` },
      { status: 502 },
    )
  }

  const body = result.data
  const fromEmail = body.from.match(/<(.+)>/)?.[1] ?? body.from
  const [lead] = await db.select().from(leads).where(ilike(leads.email, fromEmail)).limit(1)
  let originalEmailId: string | null = null
  const inReplyTo =
    body.headers && typeof body.headers === 'object'
      ? (body.headers['in-reply-to'] as string | undefined) ?? null
      : null

  if (inReplyTo) {
    const [orig] = await db.select().from(emails).where(eq(emails.providerMessageId, inReplyTo)).limit(1)
    if (orig) originalEmailId = orig.id
  }
  const sentiment = await classifySentiment(body.subject ?? '', body.text ?? '')
  const [reply] = await db.insert(replies).values({
    leadId: lead?.id ?? null,
    emailId: originalEmailId,
    threadId: inReplyTo ?? body.message_id ?? null,
    subject: body.subject ?? null,
    bodyText: body.text ?? null,
    bodyHtml: body.html ?? null,
    fromAddress: fromEmail,
    sentiment,
  }).returning()
  if (lead) {
    await db.update(leads).set({
      lastRepliedAt: new Date(),
      gtmStatus: 'engaged',
      totalReplies: lead.totalReplies + 1,
    }).where(eq(leads.id, lead.id))
    await db.insert(activities).values({ leadId: lead.id, type: 'reply_received', metadata: { replyId: reply.id, sentiment } })
    await db.update(sequenceEnrollments).set({ status: 'stopped_replied', completedAt: new Date() }).where(
      eq(sequenceEnrollments.leadId, lead.id)
    )
    if (sentiment === 'unsubscribe') {
      await db.insert(suppressions).values({ email: lead.email, reason: 'unsubscribed' }).onConflictDoNothing()
      await db.update(leads).set({ gtmStatus: 'unsubscribed' }).where(eq(leads.id, lead.id))
    }
  }
  return NextResponse.json({ ok: true })
}
