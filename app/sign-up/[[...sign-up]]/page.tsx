import { SetupState } from '@/components/setup-state'
import { hasClerkRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'

export default async function SignUpPage() {
  if (isAuthDisabled()) {
    return (
      <SetupState
        title="Authentication is bypassed for testing"
        description="Forge GTM is running in temporary no-auth mode, so account creation is disabled while the app is being tested."
      />
    )
  }

  if (!hasClerkRuntimeEnv()) {
    return (
      <SetupState
        title="Sign-up is not ready yet"
        description="Clerk is not fully configured in the deployed worker right now, so account creation is temporarily unavailable."
      />
    )
  }

  const { SignUp } = await import('@clerk/nextjs')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f3ee]">
      <div className="text-center">
        <h1 className="text-3xl font-serif font-light mb-8 text-[#1a1814]">Forge GTM</h1>
        <SignUp />
      </div>
    </div>
  )
}
