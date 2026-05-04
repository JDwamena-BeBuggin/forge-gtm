import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f3ee]">
      <div className="text-center">
        <h1 className="text-3xl font-serif font-light mb-8 text-[#1a1814]">Forge GTM</h1>
        <SignIn />
      </div>
    </div>
  )
}
