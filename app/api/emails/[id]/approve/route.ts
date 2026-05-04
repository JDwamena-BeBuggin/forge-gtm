import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { emails } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(_req: NextRequest, { params }: Params) {
  const { error, userId } = requireAuth()
  if (error) return error
  const { id } = await params
  const [updated] = await db
    .update(emails)
    .set({ approvedAt: new Date(), approvedBy: userId!, status: 'scheduled' })
    .where(eq(emails.id, id))
    .returning()
  return NextResponse.json(updated)
}
