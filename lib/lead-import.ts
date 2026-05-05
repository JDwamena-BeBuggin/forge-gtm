import * as XLSX from 'xlsx'

type ParsedImportRow = Record<string, string>

const HEADER_ALIASES: Record<string, string> = {
  website: 'website',
  deal_website: 'website',
  email: 'email',
  email_address: 'email',
  work_email: 'email',
  person_email: 'email',
  first_name: 'first_name',
  firstname: 'first_name',
  given_name: 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  family_name: 'last_name',
  full_name: 'full_name',
  name: 'full_name',
  person_name: 'full_name',
  company: 'company',
  company_name: 'company',
  organization: 'company',
  organisation: 'company',
  deal_organization: 'company',
  title: 'title',
  job_title: 'title',
  role: 'title',
  deal_title: 'deal_title',
  deal_value: 'deal_value',
  linkedin: 'linkedin_url',
  linkedin_url: 'linkedin_url',
  linkedin_profile: 'linkedin_url',
  company_website: 'website',
  phone: 'phone',
  phone_number: 'phone',
  mobile: 'phone',
  person_number: 'phone',
  industry: 'industry',
  person_industry: 'industry',
  segment: 'segment',
  source: 'source',
  client_notes: 'client_notes',
  notes: 'notes',
  cadence_step_1: 'cadence_step_1',
  cadence_step_2: 'cadence_step_2',
  cadence_step_3: 'cadence_step_3',
  added_to_sequence: 'added_to_sequence',
}

function normalizeHeader(header: unknown) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function splitFullName(fullName: string) {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: null, lastName: null }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: null }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1).join(' '),
  }
}

function sanitizeCell(value: unknown) {
  if (value == null) return ''
  return String(value).trim()
}

function splitEmails(rawEmails: string) {
  return rawEmails
    .split(/[,\n;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeRow(row: Record<string, unknown>): ParsedImportRow {
  const normalizedEntries = Object.entries(row).map(([key, value]) => {
    const normalizedKey = HEADER_ALIASES[normalizeHeader(key)] ?? normalizeHeader(key)
    return [normalizedKey, sanitizeCell(value)] as const
  })

  return Object.fromEntries(normalizedEntries)
}

export function mapImportRows(rows: Record<string, unknown>[], sheetName?: string) {
  return rows
    .map(normalizeRow)
    .flatMap((row) => {
      const emails = splitEmails(row.email ?? '')
      const splitName = splitFullName(row.full_name ?? '')
      const firstName = row.first_name || splitName.firstName
      const lastName = row.last_name || splitName.lastName
      const notes = [
        row.client_notes,
        row.notes,
        row.cadence_step_1 ? `Cadence 1: ${row.cadence_step_1}` : '',
        row.cadence_step_2 ? `Cadence 2: ${row.cadence_step_2}` : '',
        row.cadence_step_3 ? `Cadence 3: ${row.cadence_step_3}` : '',
        row.deal_title ? `Deal Title: ${row.deal_title}` : '',
        row.added_to_sequence ? `Added to sequence: ${row.added_to_sequence}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const base = {
        first_name: firstName ?? '',
        last_name: lastName ?? '',
        company: row.company ?? '',
        title: row.title ?? '',
        linkedin_url: row.linkedin_url ?? '',
        website: row.website ?? '',
        phone: row.phone ?? '',
        industry: row.industry ?? '',
        segment: row.segment || sheetName || '',
        source: row.source ?? sheetName ?? 'spreadsheet_import',
        notes,
        deal_value: row.deal_value ?? '',
      }

      if (!emails.length) {
        return []
      }

      return emails.map((email) => ({
        email,
        ...base,
      }))
    })
}

export function parseLeadImportBuffer(buffer: ArrayBuffer, filename: string) {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    raw: false,
    cellDates: true,
  })

  if (!workbook.SheetNames.length) throw new Error(`No sheets found in ${filename}`)

  return workbook.SheetNames.flatMap((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) return []

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false,
    })

    return mapImportRows(rows, sheetName.trim())
  })
}
