import fs from 'node:fs'
import path from 'node:path'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { parseLeadImportBuffer } from '../lib/lead-import'

type CliOptions = {
  filePath: string
  limit?: number
}

function parseArgs(argv: string[]): CliOptions {
  let filePath = ''
  let limit: number | undefined

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--file') {
      filePath = argv[i + 1] ?? ''
      i += 1
      continue
    }
    if (arg === '--limit') {
      const raw = argv[i + 1] ?? ''
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value: ${raw}`)
      }
      limit = parsed
      i += 1
      continue
    }
  }

  if (!filePath) {
    throw new Error('Usage: tsx scripts/import-leads.ts --file "/absolute/path/to/file.xlsx" [--limit 250]')
  }

  return { filePath, limit }
}

async function main() {
  const { filePath, limit } = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')

  const resolvedFilePath = path.resolve(filePath)
  const workbook = fs.readFileSync(resolvedFilePath)
  const parsedRows = parseLeadImportBuffer(
    workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength),
    path.basename(resolvedFilePath),
  )

  const rows = typeof limit === 'number' ? parsedRows.slice(0, limit) : parsedRows
  if (!rows.length) throw new Error('No importable rows were parsed from the workbook')

  const sqlClient = neon(databaseUrl)
  const db = drizzle(sqlClient, { schema })

  let inserted = 0
  let skipped = 0
  const batchSize = 250

  console.log(
    `Preparing to import ${rows.length.toLocaleString()} rows from ${path.basename(resolvedFilePath)}${limit ? ' (test mode)' : ''}...`,
  )

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize).map((row) => ({
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

    const result = await db
      .insert(schema.leads)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: schema.leads.id })

    inserted += result.length
    skipped += chunk.length - result.length

    if (result.length > 0) {
      await db.insert(schema.activities).values(
        result.map((entry) => ({
          leadId: entry.id,
          type: 'imported',
          metadata: {
            source: limit ? 'script_test_import' : 'script_full_import',
            file: path.basename(resolvedFilePath),
          },
        })),
      )
    }

    console.log(
      `Processed ${Math.min(i + batchSize, rows.length).toLocaleString()} / ${rows.length.toLocaleString()} rows...`,
    )
  }

  console.log(
    JSON.stringify(
      {
        file: path.basename(resolvedFilePath),
        totalParsed: rows.length,
        inserted,
        skipped,
        mode: limit ? 'test' : 'full',
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
