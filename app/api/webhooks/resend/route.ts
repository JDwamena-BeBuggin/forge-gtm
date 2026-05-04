import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { emails, leads, replies, activities, sequenceEnrollments, suppressions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { classifySentiment } from '@/lib/anthropic'

async function verifySignature(req: NextRequest): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return true // Skip in dev
  // TODO: implement HMAC-SHA256 verification against svix headers
  return true
}

export async function POST(req: NextRequest) {
  if (!(await verifySignature(req))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  const { type, data } = await req.json() as {
    type: string
    data: {
      email_id?: string
      message_id?: string
      to?: string[]
      subject?: string
      bounce?: { message?: string }
      from?: string
      html?: string
      text?: string
      headers?: Record<string, string>[]
    }
  }
  async function getEmail() {
    const mid = data.email_id ?? data.message_id
    if (!mid) return null
    const [e] = await db.select().from(emails).where(eq(emails.providerMessageId, mid)).limit(1)
    return e ?? null
  }
  switch (type) {
    case 'email.sent': {
      const email = await getEmail()
      if (email) {
        await db.update(emails).set({ status: 'sent', sentAt: new Date() }).where(eq(emails.id, email.id))
        await db.update(leads).set({ lastContactedAt: new Date(), totalEmailsSent: sql`${leads.totalEmailsSent} + 1` }).where(eq(leads.id, email.leadId))
      }
      break
    }
    case 'email.delivered': {
      // no specific field to update; status stays 'sent'
      break
    }
    case 'email.opened': {
      const email = await getEmail()
      if (email) {
        await db.update(emails).set({
          openedAt: email.openedAt ?? new Date(),
          openCount: sql`${emails.openCount} + 1`,
        }).where(eq(emails.id, email.id))
        await db.insert(activities).values({ leadId: email.leadId, type: 'email_opened', metadata: { emailId: email.id } })
      }
      break
    }
    case 'email.clicked': {
      const email = await getEmail()
      if (email) {
        await db.update(emails).set({
          clickedAt: email.clickedAt ?? new Date(),
          clickCount: sql`${emails.clickCount} + 1`,
        }).where(eq(emails.id, email.id))
        await db.insert(activities).values({ leadId: email.leadId, type: 'email_clicked', metadata: { emailId: email.id } })
      }
      break
    }
    case 'email.bounced': {
      const email = await getEmail()
      if (email) {
        await db.update(emails).set({ bouncedAt: new Date(), bounceReason: data.bounce?.message, status: 'bounced' }).where(eq(emails.id, email.id))
        await db.update(leads).set({ gtmStatus: 'bounced' }).where(eq(leads.id, email.leadId))
        const [lead] = await db.select().from(leads).where(eq(leads.id, email.leadId)).limit(1)
        if (lead) {
          await db.insert(suppressions).values({ email: lead.email, reason: 'bounced' }).onConflictDoNothing()
        }
      }
      break
    }
    case 'email.complained': {
      const email = await getEmail()
      if (email) {
        const [lead] = await db.select().from(leads).where(eq(leads.id, email.leadId)).limit(1)
        if (lead) {
          await db.insert(suppressions).values({ email: lead.email, reason: 'complaint' }).onConflictDoNothing()
          await db.update(leads).set({ gtmStatus: 'unsubscribed' }).where(eq(leads.id, email.leadId))
        }
      }
      break
    }
  }
  return NextResponse.json({ ok: true })
}
