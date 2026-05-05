import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Sidebar } from '@/components/sidebar'
import { getRuntimeEnv, hasClerkRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'
import './globals.css'

export const metadata: Metadata = {
  title: 'Forge GTM',
  description: 'GTM Hub — personalised outreach at scale',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const env = getRuntimeEnv()
  const authEnabled = !isAuthDisabled(env) && hasClerkRuntimeEnv(env)
  const content = (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-[#f5f3ee]">
        <Sidebar authEnabled={authEnabled} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )

  if (!authEnabled) {
    return content
  }

  return (
    <ClerkProvider publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      {content}
    </ClerkProvider>
  )
}
