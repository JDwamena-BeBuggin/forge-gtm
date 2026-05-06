import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'

const STATEMENTS = [
  'CREATE EXTENSION IF NOT EXISTS pgcrypto',
  `
    CREATE TABLE IF NOT EXISTS leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE NOT NULL,
      first_name text,
      last_name text,
      company text,
      title text,
      linkedin_url text,
      website text,
      phone text,
      industry text,
      gtm_status text NOT NULL DEFAULT 'new',
      source text,
      segment text,
      tags text[] DEFAULT '{}',
      deal_value numeric(12, 2),
      enriched_at timestamptz,
      enrichment_data jsonb,
      research_notes text,
      research_updated_at timestamptz,
      last_contacted_at timestamptz,
      last_replied_at timestamptz,
      total_emails_sent integer NOT NULL DEFAULT 0,
      total_opens integer NOT NULL DEFAULT 0,
      total_clicks integer NOT NULL DEFAULT 0,
      total_replies integer NOT NULL DEFAULT 0,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (gtm_status)',
  'CREATE INDEX IF NOT EXISTS idx_leads_segment ON leads (segment)',
  'CREATE INDEX IF NOT EXISTS idx_leads_company ON leads (company)',
  'CREATE INDEX IF NOT EXISTS idx_leads_last_contacted ON leads (last_contacted_at)',
  `
    CREATE TABLE IF NOT EXISTS sequences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS sequence_steps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id uuid NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
      step_order integer NOT NULL,
      delay_days integer NOT NULL DEFAULT 0,
      subject_prompt text NOT NULL,
      body_prompt text NOT NULL,
      send_window_start time DEFAULT '09:00',
      send_window_end time DEFAULT '16:00',
      timezone text DEFAULT 'America/New_York'
    )
  `,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_sequence_step ON sequence_steps (sequence_id, step_order)',
  `
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      sequence_id uuid NOT NULL REFERENCES sequences(id),
      status text NOT NULL DEFAULT 'active',
      current_step integer NOT NULL DEFAULT 0,
      next_send_at timestamptz,
      enrolled_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz
    )
  `,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_sequence ON sequence_enrollments (lead_id, sequence_id)',
  'CREATE INDEX IF NOT EXISTS idx_enrollments_next_send ON sequence_enrollments (next_send_at)',
  `
    CREATE TABLE IF NOT EXISTS emails (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      enrollment_id uuid REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
      step_id uuid REFERENCES sequence_steps(id),
      subject text NOT NULL,
      body_html text NOT NULL,
      body_text text,
      generation_model text,
      generation_prompt text,
      status text NOT NULL DEFAULT 'draft',
      scheduled_for timestamptz,
      sent_at timestamptz,
      provider text NOT NULL DEFAULT 'resend',
      provider_message_id text,
      from_address text NOT NULL,
      reply_to text,
      thread_id text,
      opened_at timestamptz,
      open_count integer NOT NULL DEFAULT 0,
      clicked_at timestamptz,
      click_count integer NOT NULL DEFAULT 0,
      replied_at timestamptz,
      bounced_at timestamptz,
      bounce_reason text,
      requires_approval boolean NOT NULL DEFAULT false,
      approved_at timestamptz,
      approved_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  'CREATE INDEX IF NOT EXISTS idx_emails_lead ON emails (lead_id, sent_at)',
  'CREATE INDEX IF NOT EXISTS idx_emails_scheduled ON emails (scheduled_for)',
  'CREATE INDEX IF NOT EXISTS idx_emails_provider_id ON emails (provider_message_id)',
  `
    CREATE TABLE IF NOT EXISTS replies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
      email_id uuid REFERENCES emails(id),
      thread_id text,
      subject text,
      body_text text,
      body_html text,
      from_address text,
      received_at timestamptz NOT NULL DEFAULT now(),
      sentiment text,
      is_read boolean NOT NULL DEFAULT false
    )
  `,
  'CREATE INDEX IF NOT EXISTS idx_replies_lead ON replies (lead_id, received_at)',
  'CREATE INDEX IF NOT EXISTS idx_replies_unread ON replies (received_at)',
  `
    CREATE TABLE IF NOT EXISTS activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      type text NOT NULL,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  'CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities (lead_id, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_activities_recent ON activities (created_at)',
  `
    CREATE TABLE IF NOT EXISTS suppressions (
      email text PRIMARY KEY,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE NOT NULL,
      name text,
      role text NOT NULL DEFAULT 'member',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
]

export async function POST() {
  if (!isAuthDisabled()) {
    return NextResponse.json({ error: 'Bootstrap only allowed in test mode' }, { status: 403 })
  }

  const env = getRuntimeEnv()
  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL missing' }, { status: 500 })
  }

  const sql = neon(env.DATABASE_URL)
  const runStatement = sql as unknown as (queryText: string) => Promise<unknown>
  const executed: number[] = []

  for (let i = 0; i < STATEMENTS.length; i += 1) {
    await runStatement(STATEMENTS[i])
    executed.push(i + 1)
  }

  const leadCount = await sql`select count(*)::int as count from leads`

  return NextResponse.json({
    ok: true,
    executed: executed.length,
    leadCount: leadCount[0]?.count ?? 0,
  })
}
