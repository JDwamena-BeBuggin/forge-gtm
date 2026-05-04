import {
  pgTable, uuid, text, boolean, integer, numeric,
  timestamp, time, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── LEADS ───────────────────────────────────────────────────────────────────

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  company: text('company'),
  title: text('title'),
  linkedinUrl: text('linkedin_url'),
  website: text('website'),
  phone: text('phone'),
  industry: text('industry'),

  gtmStatus: text('gtm_status').notNull().default('new'),
  source: text('source'),
  segment: text('segment'),
  tags: text('tags').array().default(sql`'{}'`),
  dealValue: numeric('deal_value', { precision: 12, scale: 2 }),

  enrichedAt: timestamp('enriched_at', { withTimezone: true }),
  enrichmentData: jsonb('enrichment_data'),
  researchNotes: text('research_notes'),
  researchUpdatedAt: timestamp('research_updated_at', { withTimezone: true }),

  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  lastRepliedAt: timestamp('last_replied_at', { withTimezone: true }),
  totalEmailsSent: integer('total_emails_sent').notNull().default(0),
  totalOpens: integer('total_opens').notNull().default(0),
  totalClicks: integer('total_clicks').notNull().default(0),
  totalReplies: integer('total_replies').notNull().default(0),

  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => ({
  statusIdx: index('idx_leads_status').on(t.gtmStatus),
  segmentIdx: index('idx_leads_segment').on(t.segment),
  companyIdx: index('idx_leads_company').on(t.company),
  lastContactedIdx: index('idx_leads_last_contacted').on(t.lastContactedAt),
}))

// ─── SEQUENCES ────────────────────────────────────────────────────────────────

export const sequences = pgTable('sequences', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
})

export const sequenceSteps = pgTable('sequence_steps', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sequenceId: uuid('sequence_id').notNull().references(() => sequences.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull(),
  delayDays: integer('delay_days').notNull().default(0),
  subjectPrompt: text('subject_prompt').notNull(),
  bodyPrompt: text('body_prompt').notNull(),
  sendWindowStart: time('send_window_start').default('09:00'),
  sendWindowEnd: time('send_window_end').default('16:00'),
  timezone: text('timezone').default('America/New_York'),
}, (t) => ({
  uniqueStep: uniqueIndex('uq_sequence_step').on(t.sequenceId, t.stepOrder),
}))

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

export const sequenceEnrollments = pgTable('sequence_enrollments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  sequenceId: uuid('sequence_id').notNull().references(() => sequences.id),
  status: text('status').notNull().default('active'),
  currentStep: integer('current_step').notNull().default(0),
  nextSendAt: timestamp('next_send_at', { withTimezone: true }),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().default(sql`now()`),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => ({
  uniqueEnrollment: uniqueIndex('uq_lead_sequence').on(t.leadId, t.sequenceId),
  nextSendIdx: index('idx_enrollments_next_send').on(t.nextSendAt),
}))

// ─── EMAILS ───────────────────────────────────────────────────────────────────

export const emails = pgTable('emails', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').references(() => sequenceEnrollments.id, { onDelete: 'set null' }),
  stepId: uuid('step_id').references(() => sequenceSteps.id),

  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text'),
  generationModel: text('generation_model'),
  generationPrompt: text('generation_prompt'),

  status: text('status').notNull().default('draft'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),

  provider: text('provider').notNull().default('resend'),
  providerMessageId: text('provider_message_id'),
  fromAddress: text('from_address').notNull(),
  replyTo: text('reply_to'),
  threadId: text('thread_id'),

  openedAt: timestamp('opened_at', { withTimezone: true }),
  openCount: integer('open_count').notNull().default(0),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  clickCount: integer('click_count').notNull().default(0),
  repliedAt: timestamp('replied_at', { withTimezone: true }),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }),
  bounceReason: text('bounce_reason'),

  requiresApproval: boolean('requires_approval').notNull().default(false),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => ({
  leadIdx: index('idx_emails_lead').on(t.leadId, t.sentAt),
  scheduledIdx: index('idx_emails_scheduled').on(t.scheduledFor),
  providerIdx: index('idx_emails_provider_id').on(t.providerMessageId),
}))

// ─── REPLIES ──────────────────────────────────────────────────────────────────

export const replies = pgTable('replies', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  emailId: uuid('email_id').references(() => emails.id),
  threadId: text('thread_id'),
  subject: text('subject'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  fromAddress: text('from_address'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().default(sql`now()`),
  sentiment: text('sentiment'),
  isRead: boolean('is_read').notNull().default(false),
}, (t) => ({
  leadIdx: index('idx_replies_lead').on(t.leadId, t.receivedAt),
  unreadIdx: index('idx_replies_unread').on(t.receivedAt),
}))

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => ({
  leadIdx: index('idx_activities_lead').on(t.leadId, t.createdAt),
  recentIdx: index('idx_activities_recent').on(t.createdAt),
}))

// ─── SUPPRESSIONS ─────────────────────────────────────────────────────────────

export const suppressions = pgTable('suppressions', {
  email: text('email').primaryKey(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
})

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  name: text('name'),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
})

// ─── INFERRED TYPES ───────────────────────────────────────────────────────────

export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
export type Sequence = typeof sequences.$inferSelect
export type SequenceStep = typeof sequenceSteps.$inferSelect
export type Enrollment = typeof sequenceEnrollments.$inferSelect
export type Email = typeof emails.$inferSelect
export type Reply = typeof replies.$inferSelect
export type Activity = typeof activities.$inferSelect
