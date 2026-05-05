/**
 * Cloudflare Cron Worker — runs every 5 minutes.
 * Picks up sequence_enrollments with next_send_at <= now(),
 * generates a personalised email via OpenAI, and sends via Resend.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { and, lte, gte, eq, sql } from 'drizzle-orm'
import { addDays } from 'date-fns'
import { Resend } from 'resend'
import { generateEmail } from '../lib/openai'
import { bodyToHtml } from '../lib/utils'

interface Env {
  DATABASE_URL: string
  OPENAI_API_KEY: string
  RESEND_API_KEY: string
  DEFAULT_FROM_EMAIL: string
  DEFAULT_FROM_NAME: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const sqlClient = neon(env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })
    const resend = new Resend(env.RESEND_API_KEY)

    const now = new Date()
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000) // 15 min lookback

    // Find due enrollments
    const due = await db
      .select()
      .from(schema.sequenceEnrollments)
      .where(
        and(
          eq(schema.sequenceEnrollments.status, 'active'),
          lte(schema.sequenceEnrollments.nextSendAt, now),
          gte(schema.sequenceEnrollments.nextSendAt, windowStart),
        ),
      )
      .limit(50)

    for (const enrollment of due) {
      try {
        // Get next step
        const [step] = await db
          .select()
          .from(schema.sequenceSteps)
          .where(
            and(
              eq(schema.sequenceSteps.sequenceId, enrollment.sequenceId),
              eq(schema.sequenceSteps.stepOrder, enrollment.currentStep + 1),
            ),
          )
          .limit(1)

        if (!step) {
          // Sequence complete
          await db
            .update(schema.sequenceEnrollments)
            .set({ status: 'completed', completedAt: now })
            .where(eq(schema.sequenceEnrollments.id, enrollment.id))
          continue
        }

        // Get lead
        const [lead] = await db
          .select()
          .from(schema.leads)
          .where(eq(schema.leads.id, enrollment.leadId))
          .limit(1)
        if (!lead) continue

        // Check suppression
        const [suppressed] = await db
          .select()
          .from(schema.suppressions)
          .where(eq(schema.suppressions.email, lead.email))
          .limit(1)
        if (suppressed) {
          await db
            .update(schema.sequenceEnrollments)
            .set({ status: 'stopped_unsubscribed', completedAt: now })
            .where(eq(schema.sequenceEnrollments.id, enrollment.id))
          continue
        }

        // Prior emails in thread
        const priorEmails = await db
          .select()
          .from(schema.emails)
          .where(eq(schema.emails.leadId, lead.id))
          .limit(5)
        const generated = await generateEmail(lead, step, priorEmails, undefined, {
          apiKey: env.OPENAI_API_KEY,
          senderName: env.DEFAULT_FROM_NAME,
        })
        const { subject, body } = generated

        const fromAddress = `${env.DEFAULT_FROM_NAME} <${env.DEFAULT_FROM_EMAIL}>`

        // Insert email record
        const [emailRecord] = await db
          .insert(schema.emails)
          .values({
            leadId: lead.id,
            enrollmentId: enrollment.id,
            stepId: step.id,
            subject,
            bodyHtml: bodyToHtml(body),
            bodyText: body,
            generationModel: generated.model,
            generationPrompt: generated.prompt,
            status: 'sending',
            fromAddress,
          })
          .returning()

        // Send via Resend
        const result = await resend.emails.send({
          from: fromAddress,
          to: [lead.email],
          subject,
          html: bodyToHtml(body),
          text: body,
          tags: [
            { name: 'lead_id', value: lead.id },
            { name: 'email_id', value: emailRecord.id },
          ],
        })

        if (result.error) {
          await db.update(schema.emails).set({ status: 'failed' }).where(eq(schema.emails.id, emailRecord.id))
          continue
        }

        // Update email → sent
        await db
          .update(schema.emails)
          .set({ providerMessageId: result.data?.id, status: 'sent', sentAt: now })
          .where(eq(schema.emails.id, emailRecord.id))

        // Update lead engagement
        await db
          .update(schema.leads)
          .set({ lastContactedAt: now, totalEmailsSent: sql`${schema.leads.totalEmailsSent} + 1` })
          .where(eq(schema.leads.id, lead.id))

        // Advance enrollment
        const nextStepRecord = await db
          .select()
          .from(schema.sequenceSteps)
          .where(
            and(
              eq(schema.sequenceSteps.sequenceId, enrollment.sequenceId),
              eq(schema.sequenceSteps.stepOrder, step.stepOrder + 1),
            ),
          )
          .limit(1)

        const nextSendAt = nextStepRecord[0] ? addDays(now, nextStepRecord[0].delayDays) : null

        await db
          .update(schema.sequenceEnrollments)
          .set({
            currentStep: step.stepOrder,
            nextSendAt: nextSendAt,
            status: nextSendAt ? 'active' : 'completed',
            completedAt: nextSendAt ? null : now,
          })
          .where(eq(schema.sequenceEnrollments.id, enrollment.id))

        // Activity log
        await db.insert(schema.activities).values({
          leadId: lead.id,
          type: 'email_sent',
          metadata: { emailId: emailRecord.id, subject, step: step.stepOrder },
        })
      } catch (err) {
        console.error(`Failed to process enrollment ${enrollment.id}:`, err)
      }
    }
  },
}
