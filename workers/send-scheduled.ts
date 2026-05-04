/**
 * Cloudflare Cron Worker — runs every 5 minutes.
 * Picks up sequence_enrollments with next_send_at <= now(),
 * generates a personalised email via Claude, and sends via Resend.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { and, lte, gte, eq, sql } from 'drizzle-orm'
import { addDays } from 'date-fns'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

interface Env {
  DATABASE_URL: string
  ANTHROPIC_API_KEY: string
  RESEND_API_KEY: string
  DEFAULT_FROM_EMAIL: string
  DEFAULT_FROM_NAME: string
}

function bodyToHtml(text: string): string {
  return `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#1a1814;max-width:600px">${text
    .split('\n')
    .map((l) => `<p style="margin:0 0 12px">${l}</p>`)
    .join('')}</div>`
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const sqlClient = neon(env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })
    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
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

        const priorText = priorEmails.length
          ? priorEmails.map((e) => `--- ${e.sentAt?.toISOString()} ---\nSubject: ${e.subject}\n${e.bodyText ?? ''}`).join('\n\n')
          : 'None'

        const prompt = `Write step ${step.stepOrder} of a sequence for this lead.

LEAD:
- Name: ${lead.firstName ?? ''} ${lead.lastName ?? ''}
- Company: ${lead.company ?? 'Unknown'}
- Industry: ${lead.industry ?? 'Unknown'}
- Segment: ${lead.segment ?? 'Unknown'}

RESEARCH:
${lead.researchNotes ?? 'No research available.'}

PRIOR EMAILS IN THREAD:
${priorText}

INSTRUCTION:
${step.bodyPrompt}

Return ONLY valid JSON: { "subject": "...", "body": "..." }`

        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `You write concise, professional 1:1 outreach emails. 80-150 words. No placeholders. Personal opener. One clear ask.`,
          messages: [{ role: 'user', content: prompt }],
        })

        const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue
        const { subject, body } = JSON.parse(jsonMatch[0]) as { subject: string; body: string }

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
            generationModel: 'claude-sonnet-4-6',
            generationPrompt: prompt,
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
