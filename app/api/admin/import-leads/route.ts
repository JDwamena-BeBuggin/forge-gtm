import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads } from '@/lib/db/schema'
import { isAuthDisabled } from '@/lib/runtime-env'

type ImportRow = {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  title?: string
  linkedin_url?: string
  website?: string
  phone?: string
  industry?: string
  segment?: string
  source?: string
  notes?: string
  deal_value?: string
}

function normalizeRows(rows: ImportRow[]) {
  return rows
    .map((row) => ({
      email: row.email?.trim().toLowerCase(),
      firstName: row.first_name?.trim() || null,
      lastName: row.last_name?.trim() || null,
      company: row.company?.trim() || null,
      title: row.title?.trim() || null,
      linkedinUrl: row.linkedin_url?.trim() || null,
      website: row.website?.trim() || null,
      phone: row.phone?.trim() || null,
      industry: row.industry?.trim() || null,
      segment: row.segment?.trim() || null,
      source: row.source?.trim() || 'spreadsheet_import',
      notes: row.notes?.trim() || null,
      dealValue: row.deal_value ? row.deal_value.replace(/[^0-9.-]/g, '') || null : null,
    }))
    .filter((row) => row.email)
}

export async function POST(req: NextRequest) {
  if (!isAuthDisabled()) {
    return NextResponse.json({ error: 'Bulk import only allowed in test mode' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows array required' }, { status: 400 })
  }

  const normalized = normalizeRows(body.rows as ImportRow[])
  if (!normalized.length) {
    return NextResponse.json({ error: 'No valid rows to import' }, { status: 400 })
  }

  const result = await db
    .insert(leads)
    .values(normalized)
    .onConflictDoNothing()
    .returning({ id: leads.id })

  return NextResponse.json({
    inserted: result.length,
    skipped: normalized.length - result.length,
  })
}
