import { NextResponse } from 'next/server'
import { getRuntimeEnvStatus } from '@/lib/runtime-env'

export async function GET() {
  const status = getRuntimeEnvStatus()
  return NextResponse.json({
    ok: status.clerk && status.database && status.openai && status.resendApi,
    status,
  })
}
