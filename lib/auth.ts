import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAuthDisabled } from './runtime-env'

export function requireAuth() {
  if (isAuthDisabled()) {
    return { userId: 'local-test-user', error: null }
  }

  const authObj = auth()
  // auth() in Clerk v5+ on edge runtime returns a synchronous object in route handlers
  // We cast to handle both sync and async shapes
  const userId = (authObj as { userId?: string }).userId
  if (!userId) {
    return { userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { userId, error: null }
}
