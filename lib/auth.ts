import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export function requireAuth() {
  const { userId } = auth()
  if (!userId) {
    return { userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { userId, error: null }
}
