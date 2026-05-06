import fs from 'node:fs'
import path from 'node:path'
import { parseLeadImportBuffer } from '../lib/lead-import'

type CliOptions = {
  apiBase: string
  filePath: string
  batchSize: number
  startBatch: number
  maxBatches?: number
}

function parseArgs(argv: string[]): CliOptions {
  let apiBase = 'https://forge-gtm.joshdwamena.workers.dev'
  let filePath = ''
  let batchSize = 500
  let startBatch = 0
  let maxBatches: number | undefined

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--file') {
      filePath = argv[i + 1] ?? ''
      i += 1
      continue
    }
    if (arg === '--api-base') {
      apiBase = argv[i + 1] ?? apiBase
      i += 1
      continue
    }
    if (arg === '--batch-size') {
      const parsed = Number.parseInt(argv[i + 1] ?? '', 10)
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Invalid --batch-size')
      batchSize = parsed
      i += 1
      continue
    }
    if (arg === '--start-batch') {
      const parsed = Number.parseInt(argv[i + 1] ?? '', 10)
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid --start-batch')
      startBatch = parsed
      i += 1
      continue
    }
    if (arg === '--max-batches') {
      const parsed = Number.parseInt(argv[i + 1] ?? '', 10)
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Invalid --max-batches')
      maxBatches = parsed
      i += 1
    }
  }

  if (!filePath) {
    throw new Error('Usage: tsx scripts/import-live.ts --file "/absolute/path/to/file.xlsx" [--api-base ...] [--batch-size 500]')
  }

  return { apiBase, filePath, batchSize, startBatch, maxBatches }
}

async function postChunk(apiBase: string, rows: Record<string, string>[], batchNumber: number) {
  const response = await fetch(`${apiBase}/api/admin/import-leads`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ rows }),
  })

  const text = await response.text()
  let parsed: Record<string, unknown> | null = null

  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    parsed = null
  }

  if (!response.ok) {
    throw new Error(`Batch ${batchNumber} failed with ${response.status}: ${parsed?.error ?? text}`)
  }

  return parsed ?? {}
}

async function main() {
  const { apiBase, filePath, batchSize, startBatch, maxBatches } = parseArgs(process.argv.slice(2))
  const resolvedFilePath = path.resolve(filePath)
  const workbook = fs.readFileSync(resolvedFilePath)
  const parsedRows = parseLeadImportBuffer(
    workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength),
    path.basename(resolvedFilePath),
  )

  const totalBatches = Math.ceil(parsedRows.length / batchSize)
  const endBatchExclusive = typeof maxBatches === 'number'
    ? Math.min(totalBatches, startBatch + maxBatches)
    : totalBatches

  let inserted = 0
  let skipped = 0

  console.log(`Parsed ${parsedRows.length.toLocaleString()} importable rows from ${path.basename(resolvedFilePath)}.`)
  console.log(`Sending batches ${startBatch + 1} to ${endBatchExclusive} of ${totalBatches} to ${apiBase}.`)

  for (let batchIndex = startBatch; batchIndex < endBatchExclusive; batchIndex += 1) {
    const start = batchIndex * batchSize
    const chunk = parsedRows.slice(start, start + batchSize)
    const result = await postChunk(apiBase, chunk, batchIndex + 1)

    inserted += Number(result.inserted ?? 0)
    skipped += Number(result.skipped ?? 0)

    console.log(
      JSON.stringify({
        batch: batchIndex + 1,
        batchesTotal: totalBatches,
        rowsSent: chunk.length,
        inserted: result.inserted ?? 0,
        skipped: result.skipped ?? 0,
        insertedRunningTotal: inserted,
        skippedRunningTotal: skipped,
      }),
    )
  }

  console.log(JSON.stringify({
    ok: true,
    totalRowsParsed: parsedRows.length,
    batchesProcessed: endBatchExclusive - startBatch,
    inserted,
    skipped,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
