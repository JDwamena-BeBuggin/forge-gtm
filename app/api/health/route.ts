import { NextResponse } from 'next/server'
import { getDatabaseRuntimeDiagnostics, getRuntimeEnvStatus } from '@/lib/runtime-env'

export async function GET() {
  const status = getRuntimeEnvStatus()
  const database = getDatabaseRuntimeDiagnostics()
  return NextResponse.json({
    ok: (status.authDisabled || status.clerk) && status.database && status.openai && status.resendApi,
    status,
    diagnostics: {
      database,
    },
  })
}
