import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { getRuntimeEnv, hasClerkRuntimeEnv } from '@/lib/runtime-env'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/resend(.*)',
])

const clerkHandler = clerkMiddleware((auth, req) => {
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

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!hasClerkRuntimeEnv()) {
    return NextResponse.next()
  }

  return clerkHandler(req, event)
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
