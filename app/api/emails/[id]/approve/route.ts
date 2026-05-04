import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { emails } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { auth } from '@clerk/nextjs/server'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const { error, userId } = requireAuth()
  if (error) return error

  const [updated] = await db
    .update(emails)
    .set({ approvedAt: new Date(), approvedBy: userId!, status: 'scheduled' })
    .where(eq(emails.id, params.id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
