import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SetupState } from '@/components/setup-state'
import { hasClerkRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'

export default async function InboxPage() {
  const authDisabled = isAuthDisabled()
  if (!authDisabled && !hasClerkRuntimeEnv()) {
    return <SetupState title="Inbox is waiting on auth setup" />
  }

  if (!authDisabled) {
    const { userId } = await auth()
    if (!userId) redirect('/sign-in')
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[#9b9589]">Outreach Replies</p>
        <h1 className="mt-2 font-serif text-3xl font-light">Inbox</h1>
        <p className="mt-2 text-sm text-[#6b6560]">
          Replies will become useful once the live database and production auth are fully active.
        </p>
      </div>
      <div className="rounded-2xl border border-[#e8e4dc] bg-white p-8 text-center">
        <p className="font-serif text-2xl font-light text-[#9b9589]">Inbox is in standby</p>
        <p className="mt-2 text-sm text-[#6b6560]">
          This section remains available, but the product is now centered on leads, enrichment, and analytics.
        </p>
      </div>
    </div>
  )
}
