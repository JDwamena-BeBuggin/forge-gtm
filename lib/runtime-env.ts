type RuntimeEnv = Record<string, string | undefined>

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'databaseUrl',
  'database_url',
  'url',
  'connectionString',
  'connection_string',
  'pooledConnectionString',
  'pooled_connection_string',
  'databaseUrlPooled',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'NEON_DATABASE_URL',
] as const

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === 'string' && value.trim())
}

function hasPrefix(value: string | undefined, prefixes: string[]) {
  return !!value && prefixes.some((prefix) => value.startsWith(prefix))
}

function isPlaceholderValue(value: string | undefined) {
  if (!value) return false

  const normalized = value.trim().toLowerCase()
  return [
    'host',
    'hostname',
    'dbname',
    'database',
    'database_name',
    'username',
    'user',
    'password',
    'postgres',
    'your-host',
    'your-database',
    'your-username',
    'your-password',
  ].includes(normalized)
}

function isTruthy(value: string | undefined) {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function isValidClerkPublishableKey(value: string | undefined) {
  if (!value) return false
  if (!hasPrefix(value, ['pk_', 'pk_test_', 'pk_live_'])) return false

  const encoded = value.replace(/^pk_(test_|live_)?/, '')
  if (!encoded) return false

  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = Buffer.from(padded, 'base64').toString('utf8')
    return decoded.length > 0 && decoded.includes('.')
  } catch {
    return false
  }
}

function parseMaybeJson(value?: string) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
}

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
    || (value.startsWith('`') && value.endsWith('`'))
  ) {
    return value.slice(1, -1).trim()
  }

  return value
}

function normalizeEnvValue(value: string) {
  return stripWrappingQuotes(value.trim())
}

function readFromEnvLines(rawValue: string | undefined, keys: string[]) {
  if (!rawValue) return undefined

  const lines = rawValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (line.startsWith('#')) continue

    for (const key of keys) {
      const prefixes = [`${key}=`, `export ${key}=`]
      const prefix = prefixes.find((candidate) => line.startsWith(candidate))
      if (prefix) {
        return normalizeEnvValue(line.slice(prefix.length))
      }
    }
  }

  return undefined
}

function readObjectValue(
  objectValue: Record<string, unknown> | null,
  keys: string[],
) {
  if (!objectValue) return undefined

  for (const key of keys) {
    const value = objectValue[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function coerceGroupedSecret(
  rawValue: string | undefined,
  keys: string[],
  validators: Array<(value: string) => boolean> = [],
) {
  if (!rawValue) return undefined

  const objectValue = parseMaybeJson(rawValue)
  const fromObject = readObjectValue(objectValue, keys)
  if (fromObject) return fromObject

  const fromEnvLines = readFromEnvLines(rawValue, keys)
  if (fromEnvLines) {
    if (!validators.length || validators.some((validator) => validator(fromEnvLines))) {
      return fromEnvLines
    }
  }

  const trimmed = rawValue.trim()
  if (!trimmed || trimmed.startsWith('{')) return undefined

  const normalized = normalizeEnvValue(trimmed)
  if (!validators.length || validators.some((validator) => validator(normalized))) {
    return normalized
  }

  return undefined
}

function assignIfMissing(env: RuntimeEnv, key: string, value?: string) {
  if (!env[key] && value) {
    env[key] = value
  }
}

function toRuntimeEnv(env: NodeJS.ProcessEnv | RuntimeEnv): RuntimeEnv {
  const runtimeEnv: RuntimeEnv = {}

  for (const [key, value] of Object.entries(env)) {
    runtimeEnv[key] = typeof value === 'string' ? value : undefined
  }

  return runtimeEnv
}

export function hydrateRuntimeEnv(env: NodeJS.ProcessEnv | RuntimeEnv = process.env) {
  const runtimeEnv = toRuntimeEnv(env)
  const resendSecret = firstDefined(runtimeEnv['Resend'], runtimeEnv['Resend1'])

  assignIfMissing(
    runtimeEnv,
    'DATABASE_URL',
    coerceGroupedSecret(runtimeEnv['Neon'], [...DATABASE_URL_KEYS], [
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    ]),
  )

  assignIfMissing(
    runtimeEnv,
    'OPENAI_API_KEY',
    coerceGroupedSecret(runtimeEnv['OpenAI'], ['OPENAI_API_KEY', 'apiKey', 'api_key', 'key'], [
      (value) => value.startsWith('sk-'),
    ]),
  )

  assignIfMissing(
    runtimeEnv,
    'RESEND_API_KEY',
    coerceGroupedSecret(resendSecret, ['RESEND_API_KEY', 'apiKey', 'api_key', 'key'], [
      (value) => value.startsWith('re_'),
    ]),
  )

  assignIfMissing(
    runtimeEnv,
    'RESEND_WEBHOOK_SECRET',
    coerceGroupedSecret(resendSecret, ['RESEND_WEBHOOK_SECRET', 'webhookSecret', 'webhook_secret'], [
      (value) => value.startsWith('whsec_'),
    ]),
  )

  assignIfMissing(
    runtimeEnv,
    'DEFAULT_FROM_EMAIL',
    coerceGroupedSecret(resendSecret, ['DEFAULT_FROM_EMAIL', 'defaultFromEmail', 'fromEmail', 'from_email']),
  )

  assignIfMissing(
    runtimeEnv,
    'CLERK_SECRET_KEY',
    coerceGroupedSecret(runtimeEnv['Clerk'], ['CLERK_SECRET_KEY', 'secretKey', 'secret_key'], [
      (value) => value.startsWith('sk_') || value.startsWith('sk_test_') || value.startsWith('sk_live_'),
    ]),
  )

  assignIfMissing(
    runtimeEnv,
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    coerceGroupedSecret(runtimeEnv['Clerk'], ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'publishableKey', 'publishable_key'], [
      (value) => value.startsWith('pk_') || value.startsWith('pk_test_') || value.startsWith('pk_live_'),
    ]),
  )

  return runtimeEnv
}

export function getRuntimeEnv() {
  return hydrateRuntimeEnv(process.env)
}

export function hasClerkRuntimeEnv(env: RuntimeEnv = getRuntimeEnv()) {
  return hasPrefix(env.CLERK_SECRET_KEY, ['sk_', 'sk_test_', 'sk_live_'])
    && isValidClerkPublishableKey(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

export function isAuthDisabled(env: RuntimeEnv = getRuntimeEnv()) {
  return isTruthy(env.DISABLE_AUTH)
}

export function hasDatabaseRuntimeEnv(env: RuntimeEnv = getRuntimeEnv()) {
  const value = env.DATABASE_URL
  if (!hasPrefix(value, ['postgres://', 'postgresql://'])) return false

  try {
    const url = new URL(value as string)
    const databaseName = url.pathname.replace(/^\//, '')
    return Boolean(
      url.username
      && url.hostname
      && url.pathname
      && url.pathname !== '/'
      && !isPlaceholderValue(url.username)
      && !isPlaceholderValue(url.hostname)
      && !isPlaceholderValue(databaseName),
    )
  } catch {
    return false
  }
}

export function getDatabaseRuntimeDiagnostics(env: RuntimeEnv = getRuntimeEnv()) {
  const value = env.DATABASE_URL
  const neonSecretPresent = Boolean(env.Neon?.trim())

  if (!value) {
    return {
      ok: false,
      reason: neonSecretPresent ? 'database_url_not_extracted' : 'neon_secret_missing',
      hasNeonSecret: neonSecretPresent,
      hasDatabaseUrl: false,
    }
  }

  if (!hasPrefix(value, ['postgres://', 'postgresql://'])) {
    return {
      ok: false,
      reason: 'database_url_invalid_scheme',
      hasNeonSecret: neonSecretPresent,
      hasDatabaseUrl: true,
    }
  }

  try {
    const url = new URL(value)
    if (!url.username) {
      return {
        ok: false,
        reason: 'database_url_missing_username',
        hasNeonSecret: neonSecretPresent,
        hasDatabaseUrl: true,
      }
    }

    if (isPlaceholderValue(url.username)) {
      return {
        ok: false,
        reason: 'database_url_placeholder_username',
        hasNeonSecret: neonSecretPresent,
        hasDatabaseUrl: true,
      }
    }

    if (!url.hostname) {
      return {
        ok: false,
        reason: 'database_url_missing_hostname',
        hasNeonSecret: neonSecretPresent,
        hasDatabaseUrl: true,
      }
    }

    if (isPlaceholderValue(url.hostname)) {
      return {
        ok: false,
        reason: 'database_url_placeholder_hostname',
        hasNeonSecret: neonSecretPresent,
        hasDatabaseUrl: true,
      }
    }

    if (!url.pathname || url.pathname === '/') {
      return {
        ok: false,
        reason: 'database_url_missing_database_name',
        hasNeonSecret: neonSecretPresent,
        hasDatabaseUrl: true,
      }
    }

    const databaseName = url.pathname.replace(/^\//, '')
    if (isPlaceholderValue(databaseName)) {
      return {
        ok: false,
        reason: 'database_url_placeholder_database_name',
        hasNeonSecret: neonSecretPresent,
        hasDatabaseUrl: true,
      }
    }

    return {
      ok: true,
      reason: 'ok',
      hasNeonSecret: neonSecretPresent,
      hasDatabaseUrl: true,
      hostname: url.hostname,
      databaseName,
    }
  } catch {
    return {
      ok: false,
      reason: 'database_url_parse_failed',
      hasNeonSecret: neonSecretPresent,
      hasDatabaseUrl: true,
    }
  }
}

export function getRuntimeEnvStatus(env: RuntimeEnv = getRuntimeEnv()) {
  return {
    authDisabled: isAuthDisabled(env),
    clerk: hasClerkRuntimeEnv(env),
    database: hasDatabaseRuntimeEnv(env),
    openai: hasPrefix(env.OPENAI_API_KEY, ['sk-']),
    resendApi: hasPrefix(env.RESEND_API_KEY, ['re_']),
    resendWebhook: hasPrefix(env.RESEND_WEBHOOK_SECRET, ['whsec_']),
    defaultFromEmail: Boolean(env.DEFAULT_FROM_EMAIL),
  }
}
