type RuntimeEnv = NodeJS.ProcessEnv

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

  const trimmed = rawValue.trim()
  if (!trimmed || trimmed.startsWith('{')) return undefined

  if (!validators.length || validators.some((validator) => validator(trimmed))) {
    return trimmed
  }

  return undefined
}

function assignIfMissing(env: RuntimeEnv, key: string, value?: string) {
  if (!env[key] && value) {
    env[key] = value
  }
}

export function hydrateRuntimeEnv(env: RuntimeEnv = process.env) {
  assignIfMissing(
    env,
    'DATABASE_URL',
    coerceGroupedSecret(env.Neon, ['DATABASE_URL', 'databaseUrl', 'database_url', 'url', 'connectionString'], [
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    ]),
  )

  assignIfMissing(
    env,
    'OPENAI_API_KEY',
    coerceGroupedSecret(env.OpenAI, ['OPENAI_API_KEY', 'apiKey', 'api_key', 'key'], [
      (value) => value.startsWith('sk-'),
    ]),
  )

  assignIfMissing(
    env,
    'RESEND_API_KEY',
    coerceGroupedSecret(env.Resend, ['RESEND_API_KEY', 'apiKey', 'api_key', 'key'], [
      (value) => value.startsWith('re_'),
    ]),
  )

  assignIfMissing(
    env,
    'RESEND_WEBHOOK_SECRET',
    coerceGroupedSecret(env.Resend, ['RESEND_WEBHOOK_SECRET', 'webhookSecret', 'webhook_secret'], [
      (value) => value.startsWith('whsec_'),
    ]),
  )

  assignIfMissing(
    env,
    'DEFAULT_FROM_EMAIL',
    coerceGroupedSecret(env.Resend, ['DEFAULT_FROM_EMAIL', 'defaultFromEmail', 'fromEmail', 'from_email']),
  )

  assignIfMissing(
    env,
    'CLERK_SECRET_KEY',
    coerceGroupedSecret(env.Clerk, ['CLERK_SECRET_KEY', 'secretKey', 'secret_key'], [
      (value) => value.startsWith('sk_') || value.startsWith('sk_test_') || value.startsWith('sk_live_'),
    ]),
  )

  assignIfMissing(
    env,
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    coerceGroupedSecret(env.Clerk, ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'publishableKey', 'publishable_key'], [
      (value) => value.startsWith('pk_') || value.startsWith('pk_test_') || value.startsWith('pk_live_'),
    ]),
  )

  return env
}

export function getRuntimeEnv() {
  return hydrateRuntimeEnv(process.env)
}
