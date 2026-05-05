import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, activities } from '@/lib/db/schema'
import { requireAuth } from '@/lib/auth'
import { mapImportRows, parseLeadImportBuffer } from '@/lib/lead-import'

async function readImportRows(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      throw new Error('file is required')
    }

    const buffer = await file.arrayBuffer()
    return {
      rows: parseLeadImportBuffer(buffer, file.name),
      source: file.name.endsWith('.csv') ? 'csv_upload' : 'spreadsheet_upload',
      filename: file.name,
    }
  }

  const body = await req.json()
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    throw new Error('rows array required')
  }

  return {
    rows: mapImportRows(body.rows),
    source: 'json_import',
    filename: null,
  }
}

export async function POST(req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error
  let importPayload
  try {
    importPayload = await readImportRows(req)
  } catch (readError) {
    return NextResponse.json(
      { error: readError instanceof Error ? readError.message : 'Import payload is invalid' },
      { status: 400 },
    )
  }

  const toInsert = importPayload.rows.map((row) => ({
    email: row.email,
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    company: row.company || null,
    title: row.title || null,
    linkedinUrl: row.linkedin_url || null,
    website: row.website || null,
    phone: row.phone || null,
    industry: row.industry || null,
    segment: row.segment || null,
    source: row.source || 'import',
    notes: row.notes || null,
    dealValue: row.deal_value ? row.deal_value.replace(/[^0-9.-]/g, '') || null : null,
  }))

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'No valid rows with email addresses were found' }, { status: 400 })
  }

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
    if (result.length > 0) {
      await db.insert(activities).values(
        result.map((r) => ({ leadId: r.id, type: 'imported' as const, metadata: { source: importPayload.source } })),
      )
    }
  }
  return NextResponse.json({ inserted, skipped, filename: importPayload.filename })
}
