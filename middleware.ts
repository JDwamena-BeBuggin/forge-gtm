import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { getRuntimeEnv, hasClerkRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/resend(.*)',
])

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const env = getRuntimeEnv()
  if (isAuthDisabled(env) || !hasClerkRuntimeEnv(env)) {
    return NextResponse.next()
  }

  try {
    const clerkHandler = clerkMiddleware((auth, innerReq) => {
      if (!isPublicRoute(innerReq)) {
        auth().protect()
      }
    }, () => ({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    }))

    return clerkHandler(req, event)
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
