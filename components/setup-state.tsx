import { getRuntimeEnvStatus } from '@/lib/runtime-env'

function StateRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#e8e4dc] bg-white px-4 py-3">
      <span className="text-sm text-[#3a362e]">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        {ok ? 'ready' : 'missing'}
      </span>
    </div>
  )
}

export function SetupState({
  title = 'Forge GTM setup is still in progress',
  description = 'The app is up, but one or more production integrations are not fully available yet.',
}: {
  title?: string
  description?: string
}) {
  const status = getRuntimeEnvStatus()

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-[#e8e4dc] bg-[#f8f5ef] p-8">
        <h1 className="font-serif text-3xl font-light text-[#1a1814]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#6b6560]">{description}</p>
        <div className="mt-6 space-y-3">
          <StateRow label="Clerk authentication" ok={status.clerk} />
          <StateRow label="Neon database" ok={status.database} />
          <StateRow label="OpenAI generation" ok={status.openai} />
          <StateRow label="Resend API" ok={status.resendApi} />
          <StateRow label="Resend webhook secret" ok={status.resendWebhook} />
          <StateRow label="Default from email" ok={status.defaultFromEmail} />
        </div>
      </div>
    </div>
  )
}
