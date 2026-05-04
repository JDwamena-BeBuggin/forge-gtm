import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sendEmail } from '@/lib/resend'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error
  const { id } = await params
  await sendEmail(id)
  return NextResponse.json({ ok: true })
}
