/**
 * Cloudflare Queue Consumer — processes webhook events asynchronously.
 * Events are pushed onto EMAIL_QUEUE by the /api/webhooks/resend route
 * and consumed here so webhook responses stay fast.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { eq, sql } from 'drizzle-orm'

interface Env {
  DATABASE_URL: string
}

type WebhookMessage = {
  type: string
  emailId: string
  leadId?: string
  data?: Record<string, unknown>
}

export default {
  async queue(batch: MessageBatch<WebhookMessage>, env: Env) {
    const sqlClient = neon(env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    for (const msg of batch.messages) {
      const { type, emailId, leadId } = msg.body

      try {
        switch (type) {
          case 'email.opened':
            await db
              .update(schema.emails)
              .set({ openCount: sql`${schema.emails.openCount} + 1`, openedAt: new Date() })
              .where(eq(schema.emails.id, emailId))
            if (leadId) {
              await db
                .update(schema.leads)
                .set({ totalOpens: sql`${schema.leads.totalOpens} + 1` })
                .where(eq(schema.leads.id, leadId))
            }
            break
          case 'email.clicked':
            await db
              .update(schema.emails)
              .set({ clickCount: sql`${schema.emails.clickCount} + 1`, clickedAt: new Date() })
              .where(eq(schema.emails.id, emailId))
            if (leadId) {
              await db
                .update(schema.leads)
                .set({ totalClicks: sql`${schema.leads.totalClicks} + 1` })
                .where(eq(schema.leads.id, leadId))
            }
            break
        }
        msg.ack()
      } catch (err) {
        console.error('Queue processing error:', err)
        msg.retry()
      }
    }
  },
}
