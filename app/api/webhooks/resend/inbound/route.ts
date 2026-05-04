import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, emails, replies, activities, sequenceEnrollments, suppressions } from '@/lib/db/schema'
import { eq, ilike } from 'drizzle-orm'
import { classifySentiment } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    from: string
    to: string[]
    subject: string
    html: string
    text: string
    headers: { name: string; value: string }[]
    in_reply_to?: string
  }
  const fromEmail = body.from.match(/<(.+)>/)?.[1] ?? body.from
  const [lead] = await db.select().from(leads).where(ilike(leads.email, fromEmail)).limit(1)
  let originalEmailId: string | null = null
  if (body.in_reply_to) {
    const [orig] = await db.select().from(emails).where(eq(emails.providerMessageId, body.in_reply_to)).limit(1)
    if (orig) originalEmailId = orig.id
  }
  const sentiment = await classifySentiment(body.subject, body.text)
  const [reply] = await db.insert(replies).values({
    leadId: lead?.id ?? null,
    emailId: originalEmailId,
    threadId: body.in_reply_to ?? null,
    subject: body.subject,
    bodyText: body.text,
    bodyHtml: body.html,
    fromAddress: fromEmail,
    sentiment,
  }).returning()
  if (lead) {
    await db.update(leads).set({
      lastRepliedAt: new Date(),
      gtmStatus: 'engaged',
      totalReplies: lead.totalReplies + 1,
    }).where(eq(leads.id, lead.id))
    await db.insert(activities).values({ leadId: lead.id, type: 'replied', metadata: { replyId: reply.id, sentiment } })
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
