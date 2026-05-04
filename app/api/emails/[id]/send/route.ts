import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sendEmail } from '@/lib/resend'

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const { error } = requireAuth()
  if (error) return error

  await sendEmail(params.id)
  return NextResponse.json({ ok: true })
}
