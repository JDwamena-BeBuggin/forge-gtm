import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, activities } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error

  const body = await req.json() as { rows: Record<string, string>[] }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows array required' }, { status: 400 })
  }

  const toInsert = body.rows
    .filter((r) => r.email)
    .map((r) => ({
      email: r.email.toLowerCase().trim(),
      firstName: r.first_name ?? r.firstName ?? null,
      lastName: r.last_name ?? r.lastName ?? null,
      company: r.company ?? null,
      title: r.title ?? null,
      linkedinUrl: r.linkedin_url ?? r.linkedinUrl ?? null,
      website: r.website ?? null,
      phone: r.phone ?? null,
      industry: r.industry ?? null,
      segment: r.segment ?? null,
      source: r.source ?? 'import',
    }))

  if (toInsert.length === 0) return NextResponse.json({ error: 'No valid rows with email' }, { status: 400 })

  // Batch insert with on conflict do nothing (deduplicates by email)
  const BATCH = 100
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH)
    const result = await db
      .insert(leads)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: leads.id })

    inserted += result.length
    skipped += chunk.length - result.length

    // Bulk activity log
    if (result.length > 0) {
      await db.insert(activities).values(
        result.map((r) => ({ leadId: r.id, type: 'imported' as const, metadata: { source: 'csv_import' } })),
      )
    }
  }

  return NextResponse.json({ inserted, skipped, total: toInsert.length })
}
