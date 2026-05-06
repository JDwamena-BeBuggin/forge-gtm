import { NextResponse } from 'next/server'

export function requireAuth() {
  return { userId: 'single-user', error: null as NextResponse | null }
}
