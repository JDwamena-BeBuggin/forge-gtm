import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { getRuntimeEnv } from '../runtime-env'

type DbInstance = ReturnType<typeof drizzle<typeof schema>>

function createDb(): DbInstance {
  const url = getRuntimeEnv().DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = neon(url)
  return drizzle(sql, { schema })
}

const globalForDb = globalThis as unknown as { _db?: DbInstance }

// Lazily initialised — safe to import in route files without DATABASE_URL at build time.
export function getDb(): DbInstance {
  if (!globalForDb._db) {
    globalForDb._db = createDb()
  }
  return globalForDb._db
}

// Convenience proxy that behaves like the db instance but only
// creates the connection on first property access (i.e. first query).
export const db = new Proxy({} as DbInstance, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
