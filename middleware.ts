import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { getRuntimeEnv } from '@/lib/runtime-env'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/resend(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect()
  }
}, () => {
  const env = getRuntimeEnv()
  return {
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
