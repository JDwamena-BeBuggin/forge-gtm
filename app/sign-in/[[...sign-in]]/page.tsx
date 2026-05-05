import { SetupState } from '@/components/setup-state'
import { hasClerkRuntimeEnv } from '@/lib/runtime-env'

export default async function SignInPage() {
  if (!hasClerkRuntimeEnv()) {
    return (
      <SetupState
        title="Sign-in is not ready yet"
        description="Clerk is not fully configured in the deployed worker right now, so the sign-in experience is temporarily unavailable."
      />
    )
  }

  const { SignIn } = await import('@clerk/nextjs')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f3ee]">
      <div className="text-center">
        <h1 className="text-3xl font-serif font-light mb-8 text-[#1a1814]">Forge GTM</h1>
        <SignIn />
      </div>
    </div>
  )
}
