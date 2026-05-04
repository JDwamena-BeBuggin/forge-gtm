import { Resend } from 'resend'
import { db } from './db/client'
import { emails, leads, activities } from './db/schema'
import { eq } from 'drizzle-orm'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

export async function sendEmail(emailId: string): Promise<void> {
  const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1)
  if (!email) throw new Error(`Email ${emailId} not found`)

  const [lead] = await db.select().from(leads).where(eq(leads.id, email.leadId)).limit(1)
  if (!lead) throw new Error(`Lead ${email.leadId} not found`)

  const resend = getResend()
  const result = await resend.emails.send({
    from: email.fromAddress,
    to: [lead.email],
    subject: email.subject,
    html: email.bodyHtml,
    text: email.bodyText ?? undefined,
    reply_to: email.replyTo ?? undefined,
    headers: email.threadId ? { 'In-Reply-To': email.threadId } : {},
    tags: [
      { name: 'lead_id', value: lead.id },
      { name: 'email_id', value: email.id },
    ],
  })

  if (result.error) throw new Error(result.error.message)

  await db
    .update(emails)
    .set({
      providerMessageId: result.data?.id,
      status: 'sent',
      sentAt: new Date(),
    })
    .where(eq(emails.id, emailId))

  await db
    .update(leads)
    .set({
      lastContactedAt: new Date(),
      totalEmailsSent: lead.totalEmailsSent + 1,
    })
    .where(eq(leads.id, lead.id))

  await db.insert(activities).values({
    leadId: lead.id,
    type: 'email_sent',
    metadata: { emailId, subject: email.subject },
  })
}

export { getResend as resend }
